import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { fetchScores } from "@/lib/oddsApi";
import { scorePicksForGame } from "@/lib/scoring";
import { getWeekDetail } from "@/lib/queries";

/**
 * Pull current scores from The Odds API, update this week's games, and auto-score every pick
 * tied to a game that just went final (skipping any pick with a manual override so a
 * correction never gets silently clobbered by the next sync).
 */
export async function POST(_req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const week = await prisma.week.findUnique({
      where: { id: params.weekId },
      include: { games: true, picks: true },
    });
    if (!week) throw new Error("Week not found");

    const scores = await fetchScores();
    const scoresByEventId = new Map(scores.map((s) => [s.oddsApiEventId, s]));

    for (const game of week.games) {
      const update = game.oddsApiEventId ? scoresByEventId.get(game.oddsApiEventId) : undefined;
      if (!update || game.manualOverride) continue;
      if (update.finalHomeScore === null || update.finalAwayScore === null) continue;

      const updatedGame = await prisma.game.update({
        where: { id: game.id },
        data: {
          finalHomeScore: update.finalHomeScore,
          finalAwayScore: update.finalAwayScore,
          status: update.completed ? "final" : "in_progress",
          lastSyncedAt: new Date(),
        },
      });

      const gamePicks = week.picks.filter((p) => p.gameId === game.id);
      const results = scorePicksForGame(
        {
          id: updatedGame.id,
          homeTeam: updatedGame.homeTeam,
          awayTeam: updatedGame.awayTeam,
          finalHomeScore: updatedGame.finalHomeScore,
          finalAwayScore: updatedGame.finalAwayScore,
          status: updatedGame.status,
        },
        gamePicks.map((p) => ({
          id: p.id,
          teamPicked: p.teamPicked,
          lockedSpread: p.lockedSpread,
          gameId: p.gameId,
          manualOverride: p.manualOverride,
        }))
      );

      for (const r of results) {
        if (!r) continue;
        await prisma.pick.update({ where: { id: r.pickId }, data: { result: r.result, points: r.points } });
      }
    }

    const refreshed = await prisma.week.findUnique({ where: { id: week.id }, include: { games: true, picks: true } });
    const allGamesFinal = refreshed!.games.length > 0 && refreshed!.games.every((g) => g.status === "final");
    const allPicksScored = refreshed!.picks.every((p) => p.result !== "pending");
    if (allGamesFinal && allPicksScored && refreshed!.status !== "final") {
      await prisma.week.update({ where: { id: week.id }, data: { status: "final" } });
    }

    return getWeekDetail(week.id);
  });
}
