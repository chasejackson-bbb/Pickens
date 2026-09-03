import type { PickResult } from "./constants";

/**
 * Spread convention used throughout: a spread is always stored "from the perspective of the
 * team it's attached to." A locked spread of -3 means that team was favored by 3; +3 means
 * they were getting 3. This is why a pick's lockedSpread is computed at pick time as
 * (team === homeTeam ? game.homeSpread : -game.homeSpread) -- see deriveLockedSpread below.
 */
export function deriveLockedSpread(
  pickedTeam: string,
  homeTeam: string,
  homeSpread: number | null
): number | null {
  if (homeSpread === null) return null;
  return pickedTeam === homeTeam ? homeSpread : -homeSpread;
}

/**
 * Score a single pick against a finished game's final score.
 * Covered (1 pt): picked team's margin beat the locked spread.
 * Push (0.5 pt): margin exactly matched the spread.
 * Didn't cover (0 pt): margin fell short.
 */
export function scorePick(
  pickedTeamScore: number,
  opponentScore: number,
  lockedSpread: number
): { result: PickResult; points: number } {
  const adjustedMargin = pickedTeamScore - opponentScore + lockedSpread;
  if (adjustedMargin > 0) return { result: "covered", points: 1 };
  if (adjustedMargin === 0) return { result: "push", points: 0.5 };
  return { result: "no_cover", points: 0 };
}

export interface ScorableGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
  status: string;
}

export interface ScorablePick {
  id: string;
  teamPicked: string;
  lockedSpread: number | null;
  gameId: string | null;
  manualOverride: boolean;
}

/**
 * Compute results for every pick tied to a finished game. Returns null for a pick that can't
 * be scored yet (game not final, or no locked spread available -- e.g. most historical
 * imports, which are scored directly from their known result instead).
 */
export function scorePicksForGame(
  game: ScorableGame,
  picks: ScorablePick[]
): Array<{ pickId: string; result: PickResult; points: number } | null> {
  return picks.map((pick) => {
    if (pick.manualOverride) return null; // don't clobber a manual correction
    if (game.status !== "final") return null;
    if (game.finalHomeScore === null || game.finalAwayScore === null) return null;
    if (pick.lockedSpread === null) return null;

    const isHome = pick.teamPicked === game.homeTeam;
    const isAway = pick.teamPicked === game.awayTeam;
    if (!isHome && !isAway) return null;

    const pickedScore = isHome ? game.finalHomeScore : game.finalAwayScore;
    const oppScore = isHome ? game.finalAwayScore : game.finalHomeScore;
    const { result, points } = scorePick(pickedScore, oppScore, pick.lockedSpread);
    return { pickId: pick.id, result, points };
  });
}

/** Weekly winner: highest total points; ties broken by closest tiebreaker guess (once revealed). */
export function determineWeeklyWinner(
  playerTotals: Array<{ playerId: string; points: number }>,
  tiebreakerGuesses: Array<{ playerId: string; guessValue: number | null; revealed: boolean }>,
  actualTiebreakerValue: number | null
): { winnerIds: string[]; tied: boolean; tiebreakerApplied: boolean } {
  if (playerTotals.length === 0) return { winnerIds: [], tied: false, tiebreakerApplied: false };
  const max = Math.max(...playerTotals.map((p) => p.points));
  const leaders = playerTotals.filter((p) => p.points === max).map((p) => p.playerId);

  if (leaders.length === 1) {
    return { winnerIds: leaders, tied: false, tiebreakerApplied: false };
  }

  const canBreakTie =
    actualTiebreakerValue !== null &&
    leaders.every((id) =>
      tiebreakerGuesses.some((g) => g.playerId === id && g.revealed && g.guessValue !== null)
    );

  if (!canBreakTie) {
    return { winnerIds: leaders, tied: true, tiebreakerApplied: false };
  }

  let best: string[] = [];
  let bestDiff = Infinity;
  for (const id of leaders) {
    const guess = tiebreakerGuesses.find((g) => g.playerId === id)!;
    const diff = Math.abs((guess.guessValue as number) - (actualTiebreakerValue as number));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [id];
    } else if (diff === bestDiff) {
      best.push(id);
    }
  }
  return { winnerIds: best, tied: best.length > 1, tiebreakerApplied: true };
}
