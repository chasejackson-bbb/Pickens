import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { availableTeams, getCurrentTurn, isDraftComplete } from "@/lib/draft";
import { deriveLockedSpread } from "@/lib/scoring";
import { getWeekDetail } from "@/lib/queries";

const schema = z.object({
  playerId: z.string(),
  team: z.string().min(1),
});

/**
 * Submit the next pick in a live snake draft. Enforces turn order server-side (only the
 * player whose turn it is can succeed) so this is safe to call from any client without
 * trusting the UI to gate it.
 */
export async function POST(req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const { playerId, team } = schema.parse(await req.json());

    const week = await prisma.week.findUnique({
      where: { id: params.weekId },
      include: { games: true, picks: true, draftOrder: true },
    });
    if (!week) throw new Error("Week not found");
    if (week.status !== "drafting") throw new Error(`Week is not currently drafting (status: ${week.status})`);
    if (!week.draftOrder || week.picksPerPlayer === null) throw new Error("Draft order not set for this week");

    const baseOrder: string[] = JSON.parse(week.draftOrder.order);
    const picksMade = week.picks.length;
    const turn = getCurrentTurn(baseOrder, picksMade, week.picksPerPlayer);
    if (!turn) throw new Error("The draft for this week is already complete");
    if (turn.playerId !== playerId) throw new Error("It's not your turn to pick");

    const weekTeams = [...new Set(week.games.flatMap((g) => [g.homeTeam, g.awayTeam]))];
    const pickedTeams = week.picks.map((p) => p.teamPicked);
    const pool = availableTeams(weekTeams, pickedTeams);
    if (!pool.includes(team)) throw new Error(`${team} is not available (already picked or has a bye this week)`);

    const game = week.games.find((g) => g.homeTeam === team || g.awayTeam === team)!;
    const lockedSpread = deriveLockedSpread(team, game.homeTeam, game.homeSpread);

    const pick = await prisma.pick.create({
      data: {
        weekId: week.id,
        playerId,
        gameId: game.id,
        teamPicked: team,
        lockedSpread,
        draftOrderPosition: turn.overallPickNumber,
        pickedAt: new Date(),
        result: "pending",
      },
    });

    const nowComplete = isDraftComplete(baseOrder, picksMade + 1, week.picksPerPlayer, pool.length - 1);
    if (nowComplete) {
      await prisma.week.update({ where: { id: week.id }, data: { status: "in_progress" } });
    }

    return { pick, week: await getWeekDetail(week.id) };
  });
}
