/**
 * Import the legacy "Copy of Pickens.xlsx" spreadsheet (2018 postseason through 2025) into the
 * new database. Reads data/historical/legacy-import.json, which was produced by parsing the
 * original workbook sheet-by-sheet (see the "Historical Data Import" section of the project
 * README for how that JSON was derived and what was excluded).
 *
 * Known, deliberate limitations of this import (per the original project brief):
 *  - The spreadsheet never recorded the actual spread used for a historical pick, only the
 *    final result (covered / no_cover / push). So lockedSpread is null for nearly every
 *    imported pick -- the one exception is the 2019-season playoff sheet ("Copy of 2020
 *    Playoff Spread"), which recorded real per-game spreads and is imported with them.
 *  - No opponent/game data exists for regular-season historical picks, so Pick.gameId is null
 *    for all of them; only the team picked and the result are known.
 *  - Mike and Woodi (who played in some years alongside Blake/Jay/Chase) are intentionally
 *    excluded from this import per instruction -- only Blake/Jay/Chase picks are kept, even in
 *    seasons where all 5 played. Weekly winner/placement is therefore recomputed among just
 *    the 3 tracked players and will not always match the original spreadsheet's "Stats" tab
 *    (which ranked all 5).
 *  - 2020 and 2021 have no usable data in the workbook and are not imported, except for the
 *    2019-season playoffs (misleadingly tabbed "Copy of 2020 Playoff Spread" because those
 *    games were played in Jan/Feb 2020) and the 2018-season playoffs (tabbed "Postseason").
 *  - The 2018 postseason sheet used a different scoring mechanic entirely -- pick a team to
 *    advance, score 1 point per playoff game they won (not cover/no-cover) -- so it's imported
 *    with week.mechanic = "bracket_wins" and should never be mixed into ATS-style aggregates
 *    that assume a max of 1 point per pick.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { normalizeTeam } from "../lib/teams";

const DATA_PATH = path.join(__dirname, "..", "data", "historical", "legacy-import.json");

const TRACKED_PLAYERS = ["Blake", "Jay", "Chase"];

interface LegacyWeek {
  season: number;
  week: number;
  sheet: string;
  picks: Array<{
    player: string;
    draft_pos: number | null;
    team_raw: string;
    team_normalized: string | null;
    points_raw: number | null;
  }>;
  totals: Record<string, { canon: string | null; value: number | null }>;
  tiebreak_guesses: Record<string, number>;
  tiebreak_actual: number | null;
}

interface LegacyPostseason {
  season: number;
  label: string;
  sheet: string;
  mechanic: "bracket_wins" | "ats_with_spread";
  picks: any[];
  excluded_rows?: any[];
}

function resultFromPoints(points: number | null): { result: string; anomaly: boolean } {
  if (points === null) return { result: "pending", anomaly: false };
  if (points === 0) return { result: "no_cover", anomaly: false };
  if (points === 0.5) return { result: "push", anomaly: false };
  if (points === 1) return { result: "covered", anomaly: false };
  // Anything else (e.g. a stray 2.0 seen in one 2019 sheet) is preserved as-is per the
  // "import known result values directly, don't recompute" rule, just flagged for review.
  return { result: points > 0 ? "covered" : "no_cover", anomaly: true };
}

async function main() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const data = JSON.parse(raw) as {
    weeks: LegacyWeek[];
    postseason: LegacyPostseason[];
  };

  const players = await prisma.player.findMany({ where: { name: { in: TRACKED_PLAYERS } } });
  const playerIdByName = new Map(players.map((p) => [p.name, p.id]));
  if (playerIdByName.size !== TRACKED_PLAYERS.length) {
    throw new Error("Run `npm run db:seed` first to create the Blake/Jay/Chase players.");
  }

  const seasonCache = new Map<number, string>();
  async function seasonId(year: number): Promise<string> {
    if (seasonCache.has(year)) return seasonCache.get(year)!;
    const season = await prisma.season.upsert({ where: { year }, update: {}, create: { year } });
    seasonCache.set(year, season.id);
    return season.id;
  }

  let weeksImported = 0;
  let picksImported = 0;
  const unrecognizedTeams = new Set<string>();
  const anomalousPicks: string[] = [];

  for (const wk of data.weeks) {
    const sId = await seasonId(wk.season);
    const week = await prisma.week.upsert({
      where: { seasonId_weekNumber_label: { seasonId: sId, weekNumber: wk.week, label: "" } },
      update: { status: "final", isHistorical: true, mechanic: "ats" },
      create: {
        seasonId: sId,
        weekNumber: wk.week,
        label: "",
        status: "final",
        isHistorical: true,
        mechanic: "ats",
      },
    });

    // Clear any previous import run for this week so re-running the script is idempotent.
    await prisma.pick.deleteMany({ where: { weekId: week.id, isHistoricalImport: true } });
    await prisma.tiebreakerGuess.deleteMany({ where: { weekId: week.id } });

    for (const pick of wk.picks) {
      if (!TRACKED_PLAYERS.includes(pick.player)) continue; // Mike/Woodi already excluded upstream, belt-and-suspenders
      const playerId = playerIdByName.get(pick.player)!;
      const team = pick.team_normalized ?? normalizeTeam(pick.team_raw);
      if (!team) unrecognizedTeams.add(`${wk.season} Wk${wk.week}: "${pick.team_raw}" (${pick.player})`);

      const { result, anomaly } = resultFromPoints(pick.points_raw);
      if (anomaly) anomalousPicks.push(`${wk.season} Wk${wk.week} ${pick.player}: raw points ${pick.points_raw}`);

      await prisma.pick.create({
        data: {
          weekId: week.id,
          playerId,
          teamPicked: team ?? pick.team_raw,
          lockedSpread: null,
          draftOrderPosition: pick.draft_pos,
          result,
          points: pick.points_raw,
          isHistoricalImport: true,
          notes: team ? null : `Unrecognized team name from source sheet: "${pick.team_raw}"`,
        },
      });
      picksImported++;
    }

    // Tiebreaker: only seasons 2022+ actually used George Pickens (drafted in 2022); earlier
    // guesses are preserved but the target player/stat is unknown from the sheet alone.
    const playerName = wk.season >= 2022 ? "George Pickens" : "Unknown (legacy tiebreaker, pre-Pickens)";
    await prisma.tiebreakerConfig.upsert({
      where: { weekId: week.id },
      update: { playerName, statType: "receiving_yards", actualValue: wk.tiebreak_actual },
      create: { weekId: week.id, playerName, statType: "receiving_yards", actualValue: wk.tiebreak_actual },
    });

    for (const [name, value] of Object.entries(wk.tiebreak_guesses)) {
      if (!TRACKED_PLAYERS.includes(name)) continue;
      const playerId = playerIdByName.get(name)!;
      await prisma.tiebreakerGuess.upsert({
        where: { weekId_playerId: { weekId: week.id, playerId } },
        update: { guessValue: value, revealed: true },
        create: { weekId: week.id, playerId, guessValue: value, revealed: true },
      });
    }

    weeksImported++;
  }

  // --- Postseason sheets -------------------------------------------------------
  for (const ps of data.postseason) {
    const sId = await seasonId(ps.season);
    const mechanic = ps.mechanic === "bracket_wins" ? "bracket_wins" : "ats";
    const week = await prisma.week.upsert({
      where: { seasonId_weekNumber_label: { seasonId: sId, weekNumber: 0, label: "Postseason" } },
      update: { status: "final", isHistorical: true, isPostseason: true, mechanic },
      create: {
        seasonId: sId,
        weekNumber: 0,
        label: "Postseason",
        status: "final",
        isHistorical: true,
        isPostseason: true,
        mechanic,
      },
    });
    await prisma.pick.deleteMany({ where: { weekId: week.id, isHistoricalImport: true } });

    for (const pick of ps.picks) {
      if (!TRACKED_PLAYERS.includes(pick.player)) continue;
      const playerId = playerIdByName.get(pick.player)!;
      const team = pick.team_normalized ?? normalizeTeam(pick.team_raw);
      if (!team) unrecognizedTeams.add(`${ps.label}: "${pick.team_raw}" (${pick.player})`);

      if (ps.mechanic === "bracket_wins") {
        const wins = pick.wins as number | null;
        await prisma.pick.create({
          data: {
            weekId: week.id,
            playerId,
            teamPicked: team ?? pick.team_raw,
            lockedSpread: null,
            result: wins && wins > 0 ? "covered" : "no_cover",
            points: wins,
            isHistoricalImport: true,
            notes: "Legacy bracket pick: points = number of playoff games this team won, not cover/no-cover.",
          },
        });
      } else {
        const { result, anomaly } = resultFromPoints(pick.points_raw);
        if (anomaly) anomalousPicks.push(`${ps.label} ${pick.player}: raw points ${pick.points_raw}`);
        const contextNote =
          pick.home_team && pick.away_team ? `${pick.away_team} @ ${pick.home_team}` : null;
        await prisma.pick.create({
          data: {
            weekId: week.id,
            playerId,
            teamPicked: team ?? pick.team_raw,
            lockedSpread: pick.locked_spread ?? null,
            result,
            points: pick.points_raw,
            isHistoricalImport: true,
            sourceRound: pick.round ?? null,
            notes: contextNote,
          },
        });
      }
      picksImported++;
    }
    weeksImported++;
  }

  console.log(`\nImport complete: ${weeksImported} weeks, ${picksImported} picks.`);
  if (unrecognizedTeams.size > 0) {
    console.warn(`\n${unrecognizedTeams.size} unrecognized team name(s) (imported as raw text, needs a look):`);
    for (const t of unrecognizedTeams) console.warn(`  - ${t}`);
  }
  if (anomalousPicks.length > 0) {
    console.warn(`\n${anomalousPicks.length} pick(s) with an out-of-range result value in the source sheet:`);
    for (const a of anomalousPicks) console.warn(`  - ${a}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
