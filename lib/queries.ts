import { prisma } from "./prisma";
import { determineWeeklyWinner } from "./scoring";

export async function getActivePlayers() {
  return prisma.player.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export async function getAllPlayers() {
  return prisma.player.findMany({ orderBy: { sortOrder: "asc" } });
}

/** Cumulative points per player for a season, ranked highest first. */
export async function getSeasonStandings(seasonId: string) {
  const players = await getAllPlayers();
  const picks = await prisma.pick.findMany({
    where: { week: { seasonId } },
    select: { playerId: true, points: true },
  });

  const totals = new Map<string, number>();
  for (const p of players) totals.set(p.id, 0);
  for (const pick of picks) {
    if (pick.points === null) continue;
    totals.set(pick.playerId, (totals.get(pick.playerId) ?? 0) + pick.points);
  }

  return players
    .map((p) => ({ player: p, points: totals.get(p.id) ?? 0 }))
    .sort((a, b) => b.points - a.points);
}

/** Full detail for a single week: games, picks (joined w/ player), draft order, tiebreaker state. */
export async function getWeekDetail(weekId: string) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      season: true,
      games: true,
      picks: { include: { player: true, game: true }, orderBy: { pickedAt: "asc" } },
      tiebreakerGuesses: { include: { player: true } },
      tiebreakerConfig: true,
      draftOrder: true,
    },
  });
  if (!week) return week;
  // Guesses stay hidden (including from the player who made them) until a manual reveal.
  return {
    ...week,
    tiebreakerGuesses: week.tiebreakerGuesses.map((g) =>
      g.revealed ? g : { ...g, guessValue: null }
    ),
  };
}

/** Per-player weekly point totals + winner determination (tiebreaker-aware). */
export async function getWeekResult(weekId: string) {
  const week = await getWeekDetail(weekId);
  if (!week) return null;

  const players = await getAllPlayers();
  const totals = players.map((p) => ({
    playerId: p.id,
    points: week.picks
      .filter((pick) => pick.playerId === p.id)
      .reduce((sum, pick) => sum + (pick.points ?? 0), 0),
  }));

  const winner = determineWeeklyWinner(
    totals,
    week.tiebreakerGuesses.map((g) => ({
      playerId: g.playerId,
      guessValue: g.guessValue,
      revealed: g.revealed,
    })),
    week.tiebreakerConfig?.actualValue ?? null
  );

  return { week, totals, winner };
}

/** All-time stats across every imported + played season: total points, weeks won, placements. */
export async function getAllTimeStats() {
  const players = await getAllPlayers();
  const weeks = await prisma.week.findMany({
    where: { status: "final" },
    include: {
      picks: true,
      tiebreakerGuesses: true,
      tiebreakerConfig: true,
      season: true,
    },
  });

  const stats = new Map<
    string,
    { totalPoints: number; weeksWon: number; firsts: number; seconds: number; thirds: number; weeksPlayed: number }
  >();
  for (const p of players) {
    stats.set(p.id, { totalPoints: 0, weeksWon: 0, firsts: 0, seconds: 0, thirds: 0, weeksPlayed: 0 });
  }

  for (const week of weeks) {
    const totals = players
      .map((p) => ({
        playerId: p.id,
        points: week.picks
          .filter((pick) => pick.playerId === p.id)
          .reduce((sum, pick) => sum + (pick.points ?? 0), 0),
      }))
      .filter((t) => week.picks.some((pick) => pick.playerId === t.playerId)); // only players who played this week

    for (const t of totals) {
      const s = stats.get(t.playerId)!;
      s.totalPoints += t.points;
      s.weeksPlayed += 1;
    }

    const ranked = [...totals].sort((a, b) => b.points - a.points);
    const winner = determineWeeklyWinner(
      totals,
      week.tiebreakerGuesses.map((g) => ({
        playerId: g.playerId,
        guessValue: g.guessValue,
        revealed: g.revealed,
      })),
      week.tiebreakerConfig?.actualValue ?? null
    );
    for (const id of winner.winnerIds) {
      stats.get(id)!.weeksWon += 1;
    }

    // Placement counts (1st/2nd/3rd) by rank among players who played that week, ties share rank.
    const distinctPointValues = [...new Set(ranked.map((r) => r.points))].sort((a, b) => b - a);
    for (const t of ranked) {
      const place = distinctPointValues.indexOf(t.points) + 1;
      const s = stats.get(t.playerId)!;
      if (place === 1) s.firsts += 1;
      else if (place === 2) s.seconds += 1;
      else if (place === 3) s.thirds += 1;
    }
  }

  return players.map((p) => ({ player: p, ...stats.get(p.id)! }));
}

/** Interesting stats: most/least picked teams per player (nice-to-have surfaced on the history page). */
export async function getFavoriteTeams() {
  const picks = await prisma.pick.findMany({
    select: { playerId: true, teamPicked: true, player: { select: { name: true } } },
  });
  const byPlayer = new Map<string, Map<string, number>>();
  for (const pick of picks) {
    if (!byPlayer.has(pick.playerId)) byPlayer.set(pick.playerId, new Map());
    const m = byPlayer.get(pick.playerId)!;
    m.set(pick.teamPicked, (m.get(pick.teamPicked) ?? 0) + 1);
  }
  const result: Record<string, Array<{ team: string; count: number }>> = {};
  for (const [playerId, teamCounts] of byPlayer.entries()) {
    const name = picks.find((p) => p.playerId === playerId)!.player.name;
    result[name] = [...teamCounts.entries()]
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count);
  }
  return result;
}
