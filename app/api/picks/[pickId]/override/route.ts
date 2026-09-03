import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { PICK_RESULTS, POINTS_BY_RESULT } from "@/lib/constants";

const schema = z.object({
  result: z.enum(PICK_RESULTS.filter((r) => r !== "pending") as [string, ...string[]]),
  notes: z.string().optional(),
});

/** Manual correction for a data-source error. Marks the pick so future auto-syncs skip it. */
export async function POST(req: Request, { params }: { params: { pickId: string } }) {
  return handleRoute(async () => {
    const { result, notes } = schema.parse(await req.json());
    const points = POINTS_BY_RESULT[result as keyof typeof POINTS_BY_RESULT];
    return prisma.pick.update({
      where: { id: params.pickId },
      data: { result, points, manualOverride: true, notes },
    });
  });
}
