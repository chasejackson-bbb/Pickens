// String-union "enums," enforced in code (zod schemas at the API boundary) rather than as
// native Postgres enums -- keeps the schema portable if this ever needs to run against
// something else (e.g. SQLite for local dev) without a migration rewrite.

export const WEEK_STATUSES = ["upcoming", "drafting", "in_progress", "final"] as const;
export type WeekStatus = (typeof WEEK_STATUSES)[number];

export const GAME_STATUSES = ["scheduled", "in_progress", "final"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const PICK_RESULTS = ["pending", "covered", "push", "no_cover"] as const;
export type PickResult = (typeof PICK_RESULTS)[number];

export const WEEK_MECHANICS = ["ats", "bracket_wins"] as const;
export type WeekMechanic = (typeof WEEK_MECHANICS)[number];

export const PAYOUT_SCOPES = ["week", "season"] as const;
export type PayoutScope = (typeof PAYOUT_SCOPES)[number];

export const PAYOUT_STRUCTURES = ["winner_take_all", "split_123"] as const;
export type PayoutStructure = (typeof PAYOUT_STRUCTURES)[number];

export const POINTS_BY_RESULT: Record<Exclude<PickResult, "pending">, number> = {
  covered: 1,
  push: 0.5,
  no_cover: 0,
};

export const DEFAULT_TIEBREAKER_PLAYER = "George Pickens";
export const DEFAULT_TIEBREAKER_STAT = "receiving_yards";

/**
 * Default picks-per-player rule: floor(available teams / number of active players).
 * "Available teams" = 32 minus bye-week teams for that NFL week (teams with no game).
 * Kept as a plain function (not a stored constant) so it's trivial to swap out for a
 * different formula later without touching call sites.
 */
export function computePicksPerPlayer(availableTeamCount: number, playerCount: number): number {
  if (playerCount <= 0) return 0;
  return Math.floor(availableTeamCount / playerCount);
}
