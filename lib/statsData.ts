import { prisma } from "./prisma";

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

export async function getEligibleSeasons() {
  return prisma.season.findMany({
    where: { year: { gte: STATS_FIRST_ELIGIBLE_YEAR } },
    orderBy: { year: "desc" },
  });
}
