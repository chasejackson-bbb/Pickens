// Shared setup logic used by both the CLI scripts (scripts/seed.ts, scripts/import-legacy.ts --
// for anywhere that can reach the database directly) and the one-time HTTP setup endpoint
// (app/api/admin/setup/route.ts -- for environments, like this sandbox, that can't). Kept as
// plain async functions with no process.exit/CLI concerns so both callers can use them safely.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";
import { TEAM_ALIASES, normalizeTeam } from "./teams";

const TRACKED_PLAYERS = ["Blake", "Jay", "Chase"];

export async function seedDatabase() {
  const log: string[] = [];

  for (let i = 0; i < TRACKED_PLAYERS.length; i++) {
    await prisma.player.upsert({
      where: { name: TRACKED_PLAYERS[i] },
      update: {},
      create: { name: TRACKED_PLAYERS[i], sortOrder: i },
    });
  }
  log.push(`Seeded ${TRACKED_PLAYERS.length} players.`);

  let aliasCount = 0;
  for (const [alias, canonical] of Object.entries(TEAM_ALIASES)) {
    await prisma.teamAlias.upsert({ where: { alias }, update: { canonical }, create: { alias, canonical } });
    aliasCount++;
  }
  log.push(`Seeded ${aliasCount} team aliases.`);

  const existingConfig = await prisma.payoutConfig.findFirst({ where: { seasonId: null } });
  if (!existingConfig) {
    await prisma.payoutConfig.create({
      data: {
        weeklyPotAmount: 15,
        seasonPotAmount: 150,
        seasonEndsAtWeek: 18,
        structure: "winner_take_all",
        notes:
          "Confirmed with the group: $15/week, $150 season-long pot decided by regular-season standings through week 18. The postseason is a separate competition, not part of this pot.",
      },
    });
    log.push("Seeded default payout config ($15/week, $150/season through week 18, winner-take-all).");
  } else {
    log.push("Payout config already exists, left untouched.");
  }

  return log;
}

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
  return { result: points > 0 ? "covered" : "no_cover", anomaly: true };
}

export async function importLegacyHistory() {
  const dataPath = path.join(process.cwd(), "data", "historical", "legacy-import.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const data = JSON.parse(raw) as { weeks: LegacyWeek[]; postseason: LegacyPostseason[] };

  const players = await prisma.player.findMany({ where: { name: { in: TRACKED_PLAYERS } } });
  const playerIdByName = new Map(players.map((p) => [p.name, p.id]));
  if (playerIdByName.size !== TRACKED_PLAYERS.length) {
    throw new Error("Run seedDatabase() first to create the Blake/Jay/Chase players.");
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
      create: { seasonId: sId, weekNumber: wk.week, label: "", status: "final", isHistorical: true, mechanic: "ats" },
    });

    await prisma.pick.deleteMany({ where: { weekId: week.id, isHistoricalImport: true } });
    await prisma.tiebreakerGuess.deleteMany({ where: { weekId: week.id } });

    for (const pick of wk.picks) {
      if (!TRACKED_PLAYERS.includes(pick.player)) continue;
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
        const contextNote = pick.home_team && pick.away_team ? `${pick.away_team} @ ${pick.home_team}` : null;
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

  return {
    weeksImported,
    picksImported,
    unrecognizedTeams: [...unrecognizedTeams],
    anomalousPicks,
  };
}
