/**
 * Import the legacy "Copy of Pickens.xlsx" spreadsheet (2018 postseason through 2025) into the
 * database. Reads data/historical/legacy-import.json, which was produced by parsing the
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
 *
 * The actual logic lives in lib/setup.ts (shared with the HTTP setup endpoint at
 * app/api/admin/setup, for environments that can reach the app but not the database directly).
 */
import { prisma } from "../lib/prisma";
import { importLegacyHistory } from "../lib/setup";

importLegacyHistory()
  .then(async (result) => {
    console.log(`\nImport complete: ${result.weeksImported} weeks, ${result.picksImported} picks.`);
    if (result.unrecognizedTeams.length > 0) {
      console.warn(`\n${result.unrecognizedTeams.length} unrecognized team name(s) (imported as raw text, needs a look):`);
      result.unrecognizedTeams.forEach((t) => console.warn(`  - ${t}`));
    }
    if (result.anomalousPicks.length > 0) {
      console.warn(`\n${result.anomalousPicks.length} pick(s) with an out-of-range result value in the source sheet:`);
      result.anomalousPicks.forEach((a) => console.warn(`  - ${a}`));
    }
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
