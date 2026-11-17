import { prisma } from "./prisma";
import { determineWeeklyWinner } from "./scoring";

export async function getActivePlayers() {
  return prisma.player.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export async function getAllPlayers() {
  return prisma.player.findMany({ orderBy: { sortOrder: "asc" } });
}

/**
 * Cumulative points per player for a season, ranked highest first.
 *
 * Regular season only by default (excludes Week.isPostseason) -- this is what decides the
 * $150 season-long pot, which per the group's rules is a separate competition from the
 * playoffs. Pass includePostseason: true for a combined view; use getPostseasonStandings for
 * the playoffs' own (separate) standings.
 */
export async function getSeasonStandings(seasonId: string, options?: { includePostseason?: boolean }) {
  const players = await getAllPlayers();
  const picks = await prisma.pick.findMany({
    where: { week: { seasonId, isPostseason: options?.includePostseason ? undefined : false } },
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

/** Standings for just a season's postseason weeks -- its own separate competition, not part of the $150 season pot. */
export async function getPostseasonStandings(seasonId: string) {
  const players = await getAllPlayers();
  const picks = await prisma.pick.findMany({
    where: { week: { seasonId, isPostseason: true } },
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

export interface WeeklyStandingRow {
  weekId: string;
  weekNumber: number;
  label: string;
  status: string;
  isPostseason: boolean;
  placements: Array<{ place: number; points: number; players: Array<{ id: string; name: string }> }>;
}

/**
 * Per-week placements (1st/2nd/3rd) for every week in a season that has at least one pick --
 * shown on the standings page so the week's winner and score are visible without opening each
 * week. Plain points-based ranking, with ties sharing a place -- the same dense-ranking
 * convention as getAllTimeStats's firsts/seconds/thirds counts -- EXCEPT for a tie at 1st: if
 * the tiebreaker has an actual value recorded and every tied leader's guess is revealed,
 * determineWeeklyWinner resolves it to a single winner, exactly like the week page's own
 * "Weekly totals" winner. When that happens the resolved winner gets 1st alone, the rest of the
 * former tie drops to 2nd (still tied with each other, since there's no mechanism to break a
 * tie for anything other than the weekly win), and whatever was 2nd shifts to 3rd. A tie at
 * 1st that isn't resolvable (no actual value yet, or a guess still hidden) is shown tied, same
 * as before.
 */
export async function getWeeklyStandings(seasonId: string): Promise<WeeklyStandingRow[]> {
  const weeks = await prisma.week.findMany({
    where: { seasonId },
    orderBy: { weekNumber: "asc" },
    include: {
      picks: { include: { player: true } },
      tiebreakerGuesses: true,
      tiebreakerConfig: true,
    },
  });

  return weeks
    .filter((w) => w.picks.length > 0)
    .map((w) => {
      const totals = new Map<string, { id: string; name: string; points: number }>();
      for (const pick of w.picks) {
        if (!totals.has(pick.playerId)) totals.set(pick.playerId, { id: pick.playerId, name: pick.player.name, points: 0 });
        totals.get(pick.playerId)!.points += pick.points ?? 0;
      }
      const ranked = [...totals.values()].sort((a, b) => b.points - a.points);
      const distinctPoints = [...new Set(ranked.map((r) => r.points))].sort((a, b) => b - a);

      let groups: Array<{ points: number; players: Array<{ id: string; name: string }> }> = distinctPoints.map(
        (points) => ({ points, players: ranked.filter((r) => r.points === points).map((r) => ({ id: r.id, name: r.name })) })
      );

      if (groups.length > 0 && groups[0].players.length > 1) {
        const resolution = determineWeeklyWinner(
          ranked.map((r) => ({ playerId: r.id, points: r.points })),
          w.tiebreakerGuesses.map((g) => ({ playerId: g.playerId, guessValue: g.guessValue, revealed: g.revealed })),
          w.tiebreakerConfig?.actualValue ?? null
        );
        if (!resolution.tied && resolution.winnerIds.length === 1) {
          const winnerId = resolution.winnerIds[0];
          const winner = groups[0].players.find((p) => p.id === winnerId)!;
          const rest = groups[0].players.filter((p) => p.id !== winnerId);
          groups = [{ points: groups[0].points, players: [winner] }, { points: groups[0].points, players: rest }, ...groups.slice(1)];
        }
      }

      return {
        weekId: w.id,
        weekNumber: w.weekNumber,
        label: w.label,
        status: w.status,
        isPostseason: w.isPostseason,
        placements: groups.slice(0, 3).map((g, i) => ({ place: i + 1, points: g.points, players: g.players })),
      };
    });
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
