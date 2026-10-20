import { getStatsRawPicks, getStatsGameSides, getEligibleSeasons } from "@/lib/statsData";
import { getActivePlayers } from "@/lib/queries";
import { StatsBoard } from "./StatsBoard";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [picks, gameSides, seasons, players] = await Promise.all([
    getStatsRawPicks(),
    getStatsGameSides(),
    getEligibleSeasons(),
    getActivePlayers(),
  ]);

  return (
    <StatsBoard
      picks={picks}
      gameSides={gameSides}
      seasons={seasons.map((s) => s.year)}
      players={players.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
