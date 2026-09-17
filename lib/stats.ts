// Pure, client-safe computations over StatsPick[] for the Stats tab. No Prisma imports here --
// this runs in the browser (see app/stats/StatsBoard.tsx) so filters recompute instantly
// without a round trip.
import type { StatsPick } from "./statsData";

export interface Tally {
  covered: number;
  push: number;
  noCover: number;
  pending: number;
}

export function emptyTally(): Tally {
  return { covered: 0, push: 0, noCover: 0, pending: 0 };
}

function addResult(t: Tally, result: StatsPick["result"]) {
  if (result === "covered") t.covered += 1;
  else if (result === "push") t.push += 1;
  else if (result === "no_cover") t.noCover += 1;
  else t.pending += 1;
}

export function tally(picks: StatsPick[]): Tally {
  const t = emptyTally();
  for (const p of picks) addResult(t, p.result);
  return t;
}

export function decidedCount(t: Tally): number {
  return t.covered + t.push + t.noCover;
}

/**
 * Cover % = covered / (covered + no_cover). Pushes are excluded from both sides -- a push is
 * neither a win nor a loss against the spread, so folding it in would water down the rate.
 * Returns null (render as "—") rather than 0 when there's nothing decided yet to compute from.
 */
export function coverPct(t: Tally): number | null {
  const denom = t.covered + t.noCover;
  if (denom === 0) return null;
  return (t.covered / denom) * 100;
}

export function pushPct(t: Tally): number | null {
  const denom = decidedCount(t);
  if (denom === 0) return null;
  return (t.push / denom) * 100;
}

// --- Scope filters -----------------------------------------------------------------

export interface StatsFilters {
  seasonYears: number[];
  team: string | null;
  weekMin: number | null;
  weekMax: number | null;
}

export function applyScopeFilters(picks: StatsPick[], filters: StatsFilters): StatsPick[] {
  return picks.filter((p) => {
    if (!filters.seasonYears.includes(p.seasonYear)) return false;
    if (filters.weekMin !== null && p.weekNumber < filters.weekMin) return false;
    if (filters.weekMax !== null && p.weekNumber > filters.weekMax) return false;
    if (filters.team && p.teamPicked !== filters.team) return false;
    return true;
  });
}

export function filterByPlayer(picks: StatsPick[], playerId: string | null): StatsPick[] {
  if (!playerId) return picks;
  return picks.filter((p) => p.playerId === playerId);
}

// --- A1: situational cover % (home/away x favorite/underdog) -----------------------

export type Situation = "home_favorite" | "home_underdog" | "away_favorite" | "away_underdog";
export const SITUATIONS: Situation[] = ["home_favorite", "home_underdog", "away_favorite", "away_underdog"];

// A spread of exactly 0 ("pick'em") has no favorite -- vanishingly rare in practice, bucketed
// with favorites here so every pick lands somewhere rather than needing a 5th category.
function situationOf(p: StatsPick): Situation {
  const favorite = p.lockedSpread <= 0;
  if (p.isHome) return favorite ? "home_favorite" : "home_underdog";
  return favorite ? "away_favorite" : "away_underdog";
}

export function computeSituationalCoverage(picks: StatsPick[]): Record<Situation, Tally> {
  const bySituation = Object.fromEntries(SITUATIONS.map((s) => [s, emptyTally()])) as Record<Situation, Tally>;
  for (const p of picks) addResult(bySituation[situationOf(p)], p.result);
  return bySituation;
}

// --- A2 / per-team cover % ------------------------------------------------------------

export interface TeamCoverageRow {
  team: string;
  overall: Tally;
  home: Tally;
  away: Tally;
}

/** One row per team that was actually picked in the filtered scope -- not every NFL team. */
export function computeTeamCoverage(picks: StatsPick[]): TeamCoverageRow[] {
  const byTeam = new Map<string, TeamCoverageRow>();
  for (const p of picks) {
    if (!byTeam.has(p.teamPicked)) {
      byTeam.set(p.teamPicked, { team: p.teamPicked, overall: emptyTally(), home: emptyTally(), away: emptyTally() });
    }
    const row = byTeam.get(p.teamPicked)!;
    addResult(row.overall, p.result);
    addResult(p.isHome ? row.home : row.away, p.result);
  }
  return [...byTeam.values()].sort((a, b) => (coverPct(b.overall) ?? -1) - (coverPct(a.overall) ?? -1));
}

// --- A3 / spread-size buckets -----------------------------------------------------------

export interface SpreadBucketDef {
  label: string;
  min: number;
  max: number;
}

export const SPREAD_BUCKETS: SpreadBucketDef[] = [
  { label: "1 - 3", min: 1, max: 3 },
  { label: "3.5 - 7", min: 3.5, max: 7 },
  { label: "7.5+", min: 7.5, max: Infinity },
];

function bucketFor(magnitude: number): SpreadBucketDef | null {
  return SPREAD_BUCKETS.find((b) => magnitude >= b.min && magnitude <= b.max) ?? null;
}

export interface SpreadBucketRow {
  label: string;
  favorite: Tally;
  underdog: Tally;
}

/** Pick'em picks (spread 0) fall outside every bucket -- there's no "size" to bucket. */
export function computeSpreadBucketCoverage(picks: StatsPick[]): SpreadBucketRow[] {
  const rows = new Map<string, SpreadBucketRow>(
    SPREAD_BUCKETS.map((b) => [b.label, { label: b.label, favorite: emptyTally(), underdog: emptyTally() }])
  );
  for (const p of picks) {
    const bucket = bucketFor(Math.abs(p.lockedSpread));
    if (!bucket) continue;
    const row = rows.get(bucket.label)!;
    if (p.lockedSpread < 0) addResult(row.favorite, p.result);
    else if (p.lockedSpread > 0) addResult(row.underdog, p.result);
  }
  return SPREAD_BUCKETS.map((b) => rows.get(b.label)!);
}

// --- B1: cover % by draft position ------------------------------------------------------

export interface DraftPositionRow {
  position: number;
  tally: Tally;
}

/** Overall pick number within that week's draft (1st pick of the week, 2nd, ...). */
export function computeDraftPositionCoverage(picks: StatsPick[]): DraftPositionRow[] {
  const byPos = new Map<number, Tally>();
  for (const p of picks) {
    if (p.draftOrderPosition === null) continue;
    if (!byPos.has(p.draftOrderPosition)) byPos.set(p.draftOrderPosition, emptyTally());
    addResult(byPos.get(p.draftOrderPosition)!, p.result);
  }
  return [...byPos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([position, t]) => ({ position, tally: t }));
}

// --- B2: most-picked teams (per player, computed by caller passing pre-filtered picks) -----

export interface PlayerTeamRow {
  team: string;
  count: number;
  tally: Tally;
}

export function computeMostPickedTeams(picks: StatsPick[]): PlayerTeamRow[] {
  const byTeam = new Map<string, PlayerTeamRow>();
  for (const p of picks) {
    if (!byTeam.has(p.teamPicked)) byTeam.set(p.teamPicked, { team: p.teamPicked, count: 0, tally: emptyTally() });
    const row = byTeam.get(p.teamPicked)!;
    row.count += 1;
    addResult(row.tally, p.result);
  }
  return [...byTeam.values()].sort((a, b) => b.count - a.count);
}

// --- B3 / B4: favorite-vs-underdog and home-vs-away splits ---------------------------------

export function computeFavoriteUnderdogSplit(picks: StatsPick[]): { favorite: Tally; underdog: Tally } {
  const favorite = emptyTally();
  const underdog = emptyTally();
  for (const p of picks) {
    if (p.lockedSpread === 0) continue; // pick'em, neither
    addResult(p.lockedSpread < 0 ? favorite : underdog, p.result);
  }
  return { favorite, underdog };
}

export function computeHomeAwaySplit(picks: StatsPick[]): { home: Tally; away: Tally } {
  const home = emptyTally();
  const away = emptyTally();
  for (const p of picks) addResult(p.isHome ? home : away, p.result);
  return { home, away };
}

// --- B6: largest / smallest spread ever picked ----------------------------------------------

export interface ExtremeSpreadPick {
  team: string;
  spread: number;
  seasonYear: number;
  weekNumber: number;
}

export function computeExtremeSpreads(picks: StatsPick[]): { largest: ExtremeSpreadPick | null; smallest: ExtremeSpreadPick | null } {
  if (picks.length === 0) return { largest: null, smallest: null };
  let largest = picks[0];
  let smallest = picks[0];
  for (const p of picks) {
    if (Math.abs(p.lockedSpread) > Math.abs(largest.lockedSpread)) largest = p;
    if (Math.abs(p.lockedSpread) < Math.abs(smallest.lockedSpread)) smallest = p;
  }
  const toExtreme = (p: StatsPick): ExtremeSpreadPick => ({
    team: p.teamPicked,
    spread: p.lockedSpread,
    seasonYear: p.seasonYear,
    weekNumber: p.weekNumber,
  });
  return { largest: toExtreme(largest), smallest: toExtreme(smallest) };
}

// --- B7: win/loss streaks, per-pick -------------------------------------------------------

export interface StreakRun {
  type: "covered" | "no_cover";
  length: number;
}

export interface StreakInfo {
  current: StreakRun | null;
  longest: StreakRun | null;
}

/**
 * Per-pick streaks (not per-week): pushes and still-pending picks are skipped when walking the
 * chronological sequence, since they're neither a cover nor a non-cover and shouldn't reset or
 * extend a run. Chronological order = season year, then week number, then draft position
 * (which strictly increases through a single week's draft).
 */
export function computeStreak(picks: StatsPick[]): StreakInfo {
  const decided = picks
    .filter((p): p is StatsPick & { result: "covered" | "no_cover" } => p.result === "covered" || p.result === "no_cover")
    .slice()
    .sort(
      (a, b) =>
        a.seasonYear - b.seasonYear || a.weekNumber - b.weekNumber || (a.draftOrderPosition ?? 0) - (b.draftOrderPosition ?? 0)
    );

  if (decided.length === 0) return { current: null, longest: null };

  let longest: StreakRun | null = null;
  let runType = decided[0].result;
  let runLength = 1;
  const commitRun = () => {
    if (!longest || runLength > longest.length) longest = { type: runType, length: runLength };
  };

  for (let i = 1; i < decided.length; i++) {
    if (decided[i].result === runType) {
      runLength += 1;
    } else {
      commitRun();
      runType = decided[i].result;
      runLength = 1;
    }
  }
  commitRun();

  const last = decided[decided.length - 1].result;
  let currentLength = 1;
  for (let i = decided.length - 2; i >= 0; i--) {
    if (decided[i].result === last) currentLength += 1;
    else break;
  }

  return { current: { type: last, length: currentLength }, longest };
}

// --- B8: head-to-head weekly record -------------------------------------------------------

export interface HeadToHeadResult {
  aWins: number;
  bWins: number;
  ties: number;
  weeksCounted: number;
}

/**
 * Compares real weekly point totals (same rule the standings use), restricted to weeks where
 * both players actually had picks. Deliberately not affected by a team filter -- narrowing to
 * one team's picks would turn "who out-scored who that week" into a near-meaningless partial
 * comparison, so this always uses every pick in the season/week-range scope.
 */
export function computeHeadToHead(picks: StatsPick[], playerAId: string, playerBId: string): HeadToHeadResult {
  const weekIds = new Set(picks.map((p) => p.weekId));
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  let weeksCounted = 0;

  for (const weekId of weekIds) {
    const weekPicks = picks.filter((p) => p.weekId === weekId);
    const aPicks = weekPicks.filter((p) => p.playerId === playerAId);
    const bPicks = weekPicks.filter((p) => p.playerId === playerBId);
    if (aPicks.length === 0 || bPicks.length === 0) continue;

    weeksCounted += 1;
    const aTotal = aPicks.reduce((sum, p) => sum + (p.points ?? 0), 0);
    const bTotal = bPicks.reduce((sum, p) => sum + (p.points ?? 0), 0);
    if (aTotal > bTotal) aWins += 1;
    else if (bTotal > aTotal) bWins += 1;
    else ties += 1;
  }

  return { aWins, bWins, ties, weeksCounted };
}
