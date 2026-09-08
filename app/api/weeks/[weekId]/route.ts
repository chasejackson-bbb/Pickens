import { handleRoute, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getWeekDetail, getWeekResult } from "@/lib/queries";

export async function GET(_req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const result = await getWeekResult(params.weekId);
    if (!result) throw new Error("Week not found");
    return result;
  });
}

/**
 * Delete a week and everything tied to it (picks, games, draft order, tiebreaker state).
 * Refuses to delete a "final" week -- that's real, scored history, not a test to clean up.
 */
export async function DELETE(_req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const week = await prisma.week.findUnique({ where: { id: params.weekId } });
    if (!week) throw new Error("Week not found");
    if (week.status === "final") {
      throw new Error("Refusing to delete a final (scored) week -- that's real history, not a test.");
    }

    await prisma.$transaction([
      prisma.pick.deleteMany({ where: { weekId: week.id } }),
      prisma.tiebreakerGuess.deleteMany({ where: { weekId: week.id } }),
      prisma.tiebreakerConfig.deleteMany({ where: { weekId: week.id } }),
      prisma.draftOrder.deleteMany({ where: { weekId: week.id } }),
      prisma.game.deleteMany({ where: { weekId: week.id } }),
      prisma.payout.deleteMany({ where: { weekId: week.id } }),
      prisma.week.delete({ where: { id: week.id } }),
    ]);

    return { deleted: true };
  });
}
