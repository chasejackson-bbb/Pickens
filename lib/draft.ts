// Pure, side-effect-free snake draft logic. Kept separate from API routes / Prisma so it's
// trivial to unit test and reason about.

export interface DraftTurn {
  round: number; // 1-indexed
  indexInRound: number; // 0-indexed position within the round
  overallPickNumber: number; // 1-indexed position across the whole draft
  playerId: string;
}

/**
 * Snake draft order for a given round: odd rounds go in base order, even rounds reverse it.
 * e.g. base = [Blake, Jay, Chase] -> round 1: Blake, Jay, Chase; round 2: Chase, Jay, Blake.
 */
export function orderForRound(baseOrder: string[], round: number): string[] {
  return round % 2 === 1 ? baseOrder : [...baseOrder].reverse();
}

/**
 * Given how many picks have been made so far, whose turn is it? Returns null once the draft
 * is complete (picksMade >= picksPerPlayer * players.length).
 */
export function getCurrentTurn(
  baseOrder: string[],
  picksMade: number,
  picksPerPlayer: number
): DraftTurn | null {
  const playerCount = baseOrder.length;
  if (playerCount === 0) return null;
  const totalPicks = picksPerPlayer * playerCount;
  if (picksMade >= totalPicks) return null;

  const round = Math.floor(picksMade / playerCount) + 1;
  const indexInRound = picksMade % playerCount;
  const playerId = orderForRound(baseOrder, round)[indexInRound];

  return { round, indexInRound, overallPickNumber: picksMade + 1, playerId };
}

/** True once every player has taken their allotted picks (or there's nothing left to pick). */
export function isDraftComplete(
  baseOrder: string[],
  picksMade: number,
  picksPerPlayer: number,
  availableTeamCount: number
): boolean {
  const playerCount = baseOrder.length;
  if (playerCount === 0) return true;
  const totalPicks = picksPerPlayer * playerCount;
  return picksMade >= totalPicks || availableTeamCount === 0;
}

/** Teams with a game this week that haven't been picked yet. */
export function availableTeams(
  weekTeams: string[],
  pickedTeams: string[]
): string[] {
  const picked = new Set(pickedTeams);
  return weekTeams.filter((t) => !picked.has(t));
}

/** Fisher-Yates shuffle for randomizing draft order. Does not mutate the input. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
