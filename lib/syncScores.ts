import { prisma } from "./prisma";
import { fetchScores } from "./oddsApi";
import { scorePicksForGame } from "./scoring";

/**
 * Pull current scores from The Odds API, update one week's games, and auto-score every pick
 * tied to a game that just went final (skipping any pick with a manual override so a
 * correction never gets silently clobbered by the next sync). Shared by the per-week API
 * route (manual "Sync scores" button, callable anytime, repeatedly, as games finish) and the
 * scheduled cron job (a safety net in case nobody clicks it).
 */
export async function syncScoresForWeek(weekId: string) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { games: true, picks: true },
  });
  if (!week) throw new Error("Week not found");

  const scores = await fetchScores();
  const scoresByEventId = new Map(scores.map((s) => [s.oddsApiEventId, s]));

  let gamesUpdated = 0;
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
    gamesUpdated++;

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
  let becameFinal = false;
  if (allGamesFinal && allPicksScored && refreshed!.status !== "final") {
    await prisma.week.update({ where: { id: week.id }, data: { status: "final" } });
    becameFinal = true;
  }

  return { weekId: week.id, gamesUpdated, becameFinal };
}

/** Runs syncScoresForWeek for every week currently in progress. Used by the scheduled cron job. */
export async function syncAllInProgressWeeks() {
  const weeks = await prisma.week.findMany({ where: { status: "in_progress" }, select: { id: true } });
  const results = [];
  for (const w of weeks) {
    try {
      results.push({ ...(await syncScoresForWeek(w.id)), error: null });
    } catch (e) {
      results.push({ weekId: w.id, gamesUpdated: 0, becameFinal: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
