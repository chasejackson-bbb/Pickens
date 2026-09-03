import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { shuffle } from "@/lib/draft";
import { computePicksPerPlayer } from "@/lib/constants";
import { getWeekDetail } from "@/lib/queries";

const schema = z.object({
  manualOrder: z.array(z.string()).optional(), // explicit player-id order overrides randomization
});

/**
 * Set (or randomize) this week's draft order and kick the draft off: computes
 * picks-per-player from the games already synced for the week, snapshots it on the Week
 * record, and flips status to "drafting".
 */
export async function POST(req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const { manualOrder } = schema.parse(await req.json().catch(() => ({})));
    const week = await prisma.week.findUnique({ where: { id: params.weekId }, include: { games: true } });
    if (!week) throw new Error("Week not found");
    if (week.games.length === 0) throw new Error("Sync odds for this week before setting the draft order");

    const players = await prisma.player.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    if (players.length === 0) throw new Error("No active players configured");

    let order: string[];
    let manuallyOverridden = false;
    if (manualOrder && manualOrder.length > 0) {
      const playerIds = new Set(players.map((p) => p.id));
      if (manualOrder.length !== players.length || !manualOrder.every((id) => playerIds.has(id))) {
        throw new Error("manualOrder must contain exactly the active player IDs");
      }
      order = manualOrder;
      manuallyOverridden = true;
    } else {
      order = shuffle(players.map((p) => p.id));
    }

    const teamCount = new Set(week.games.flatMap((g) => [g.homeTeam, g.awayTeam])).size;
    const picksPerPlayer = computePicksPerPlayer(teamCount, players.length);

    await prisma.draftOrder.upsert({
      where: { weekId: week.id },
      update: { order: JSON.stringify(order), manuallyOverridden, randomizedAt: new Date() },
      create: { weekId: week.id, order: JSON.stringify(order), manuallyOverridden, randomizedAt: new Date() },
    });

    await prisma.week.update({
      where: { id: week.id },
      data: { status: "drafting", picksPerPlayer },
    });

    return getWeekDetail(week.id);
  });
}
