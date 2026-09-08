import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { fetchWeekSpreads } from "@/lib/oddsApi";
import { getWeekDetail } from "@/lib/queries";

const schema = z.object({
  from: z.string().datetime({ offset: true }).or(z.string().datetime()),
  to: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

/**
 * Pull this week's games + spreads from The Odds API and upsert them as this week's Game
 * rows. Requires a kickoff window (from/to) -- The Odds API has no "week number" concept, it
 * just returns every game with a posted line, which is routinely more than one week's worth
 * at once, so the window is what actually scopes the sync to a single NFL week. The chosen
 * window is saved on the Week so re-syncing (to refresh lines) reuses it automatically unless
 * a different one is passed. Safe to call repeatedly before the draft starts; once a game has
 * picks locked against it, re-syncing only updates its live spread display, never a pick's
 * already-locked spread (see lib/scoring.ts). Also drops any previously-synced game that falls
 * outside the (possibly adjusted) window, so narrowing the range on a re-sync self-corrects.
 */
export async function POST(req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const { from, to } = schema.parse(await req.json());
    const week = await prisma.week.findUnique({ where: { id: params.weekId } });
    if (!week) throw new Error("Week not found");
    if (week.status === "drafting" || week.status === "in_progress" || week.status === "final") {
      throw new Error("Can't re-sync odds after the draft has started for this week");
    }
    if (new Date(from) >= new Date(to)) {
      throw new Error("The window's start must be before its end");
    }

    const games = await fetchWeekSpreads({ from, to });
    if (games.length === 0) {
      throw new Error(
        "The Odds API returned no games in that window. Either lines aren't posted yet (they usually post 5-7 days before kickoff) or the window doesn't line up with this week's games -- try adjusting the dates."
      );
    }

    await prisma.week.update({
      where: { id: week.id },
      data: { windowStart: new Date(from), windowEnd: new Date(to) },
    });

    const fetchedIds = games.map((g) => g.oddsApiEventId);
    for (const g of games) {
      await prisma.game.upsert({
        where: { oddsApiEventId: g.oddsApiEventId },
        update: { homeSpread: g.homeSpread, kickoff: new Date(g.kickoff), lastSyncedAt: new Date() },
        create: {
          weekId: week.id,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          kickoff: new Date(g.kickoff),
          homeSpread: g.homeSpread,
          oddsApiEventId: g.oddsApiEventId,
          lastSyncedAt: new Date(),
        },
      });
    }
    // Drop games from a previous sync that fall outside the (possibly narrowed) window.
    // Safe -- this week hasn't started drafting yet, so no picks reference these games.
    await prisma.game.deleteMany({
      where: { weekId: week.id, oddsApiEventId: { notIn: fetchedIds } },
    });

    return getWeekDetail(week.id);
  });
}
