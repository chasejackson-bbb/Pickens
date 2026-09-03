import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { fetchWeekSpreads } from "@/lib/oddsApi";
import { getWeekDetail } from "@/lib/queries";

/**
 * Pull the current slate of NFL games + spreads from The Odds API and upsert them as this
 * week's Game rows. Safe to call repeatedly before the draft starts to refresh lines; once a
 * game has picks locked against it, re-syncing only updates its live spread display, never a
 * pick's already-locked spread (see lib/scoring.ts).
 */
export async function POST(_req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const week = await prisma.week.findUnique({ where: { id: params.weekId } });
    if (!week) throw new Error("Week not found");
    if (week.status === "drafting" || week.status === "in_progress" || week.status === "final") {
      throw new Error("Can't re-sync odds after the draft has started for this week");
    }

    const games = await fetchWeekSpreads();
    if (games.length === 0) {
      throw new Error(
        "The Odds API returned no upcoming games. Lines usually post 5-7 days before kickoff -- try again closer to the week."
      );
    }

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

    return getWeekDetail(week.id);
  });
}
