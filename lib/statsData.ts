import { prisma } from "./prisma";
import { scorePick } from "./scoring";

// Only 2026-onward picks carry a real Game link and a locked spread -- every earlier imported
// season (2018 postseason, 2019, 2022, 2024, 2025) came from a spreadsheet that only recorded
// the final win/loss result, not the spread or opponent, so there's nothing for these stats to
// compute from. Rather than partially handle incomplete seasons, the stats tab excludes
// anything before this year entirely.
export const STATS_FIRST_ELIGIBLE_YEAR = 2026;

export interface StatsPick {
  id: string;
  playerId: string;
  playerName: string;
  teamPicked: string;
  lockedSpread: number;
  result: "covered" | "push" | "no_cover" | "pending";
  points: number | null;
  draftOrderPosition: number | null;
  weekId: string;
  weekNumber: number;
  isPostseason: boolean;
  seasonYear: number;
  isHome: boolean;
  opponent: string;
}

/**
 * Flattened, spread-scoped picks for every eligible season. Restricted to "ats" weeks (the
 * standard cover/push/no-cover mechanic -- the legacy "bracket_wins" mechanic doesn't have a
 * meaningful spread), non-imported picks, and picks that actually have a locked spread + a
 * resolvable game (home/away derived at pick time in lib/scoring.ts). In practice every
 * picked-through-the-app 2026+ pick satisfies all of this; the filters just guard against the
 * one-off manual/edge case where a pick was created without a game.
 */
export async function getStatsRawPicks(): Promise<StatsPick[]> {
  const picks = await prisma.pick.findMany({
    where: {
      week: { season: { year: { gte: STATS_FIRST_ELIGIBLE_YEAR } }, mechanic: "ats" },
      isHistoricalImport: false,
      lockedSpread: { not: null },
      gameId: { not: null },
    },
    include: {
      player: true,
      game: true,
      week: { include: { season: true } },
    },
  });

  return picks
    .filter((p) => p.game !== null) // narrows the type below; the gameId filter above already guarantees this
    .map((p) => ({
      id: p.id,
      playerId: p.playerId,
      playerName: p.player.name,
      teamPicked: p.teamPicked,
      lockedSpread: p.lockedSpread as number,
      result: p.result as StatsPick["result"],
      points: p.points,
      draftOrderPosition: p.draftOrderPosition,
      weekId: p.weekId,
      weekNumber: p.week.weekNumber,
      isPostseason: p.week.isPostseason,
      seasonYear: p.week.season.year,
      isHome: p.game!.homeTeam === p.teamPicked,
      opponent: p.game!.homeTeam === p.teamPicked ? p.game!.awayTeam : p.game!.homeTeam,
    }));
}

export interface StatsGameSide {
  id: string;
  gameId: string;
  teamPicked: string; // the team this side represents -- named to match StatsPick so the
  // league-wide computations in lib/stats.ts can run over either without caring which
  opponent: string;
  lockedSpread: number;
  result: "covered" | "push" | "no_cover" | "pending";
  isHome: boolean;
  weekId: string;
  weekNumber: number;
  isPostseason: boolean;
  seasonYear: number;
}

function sideResult(
  teamScore: number | null,
  oppScore: number | null,
  spread: number
): StatsGameSide["result"] {
  if (teamScore === null || oppScore === null) return "pending";
  return scorePick(teamScore, oppScore, spread).result;
}

/**
 * Both sides of every eligible game -- home and away -- scored against the spread regardless of
 * whether anyone actually picked that team. This is what the league-wide section of the Stats
 * tab uses (per-team / situational / spread-bucket cover %): those are meant to reflect every
 * game's real ATS outcome, not just the subset of teams a player happened to draft. Only needs
 * a posted line (homeSpread not null); the game doesn't need to be final yet -- an unplayed
 * game's sides just come back "pending".
 */
export async function getStatsGameSides(): Promise<StatsGameSide[]> {
  const games = await prisma.game.findMany({
    where: {
      week: { season: { year: { gte: STATS_FIRST_ELIGIBLE_YEAR } }, mechanic: "ats" },
      homeSpread: { not: null },
    },
    include: { week: { include: { season: true } } },
  });

  const sides: StatsGameSide[] = [];
  for (const g of games) {
    const homeSpread = g.homeSpread as number;
    const common = {
      gameId: g.id,
      weekId: g.weekId,
      weekNumber: g.week.weekNumber,
      isPostseason: g.week.isPostseason,
      seasonYear: g.week.season.year,
    };
    sides.push({
      id: `${g.id}-home`,
      ...common,
      teamPicked: g.homeTeam,
      opponent: g.awayTeam,
      lockedSpread: homeSpread,
      isHome: true,
      result: sideResult(g.finalHomeScore, g.finalAwayScore, homeSpread),
    });
    sides.push({
      id: `${g.id}-away`,
      ...common,
      teamPicked: g.awayTeam,
      opponent: g.homeTeam,
      lockedSpread: -homeSpread,
      isHome: false,
      result: sideResult(g.finalAwayScore, g.finalHomeScore, -homeSpread),
    });
  }
  return sides;
}

export async function getEligibleSeasons() {
  return prisma.season.findMany({
    where: { year: { gte: STATS_FIRST_ELIGIBLE_YEAR } },
    orderBy: { year: "desc" },
  });
}
