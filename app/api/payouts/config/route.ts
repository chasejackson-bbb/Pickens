import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { PAYOUT_STRUCTURES } from "@/lib/constants";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("seasonId");
    const existing = await prisma.payoutConfig.findFirst({ where: { seasonId: seasonId ?? null } });
    if (existing) return existing;
    // Defaults inferred from the 2019 legacy sheet's only recorded dollar evidence
    // ($20 weekly pot, winner-take-all, split evenly among co-winners) -- confirm with the
    // group and edit via PUT.
    return prisma.payoutConfig.create({
      data: { seasonId: seasonId ?? undefined, weeklyPotAmount: 20, seasonPotAmount: 0, structure: "winner_take_all" },
    });
  });
}

const schema = z.object({
  seasonId: z.string().optional(),
  weeklyPotAmount: z.number().min(0).optional(),
  seasonPotAmount: z.number().min(0).optional(),
  structure: z.enum(PAYOUT_STRUCTURES).optional(),
  splitFirst: z.number().min(0).max(1).optional(),
  splitSecond: z.number().min(0).max(1).optional(),
  splitThird: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

export async function PUT(req: Request) {
  return handleRoute(async () => {
    const data = schema.parse(await req.json());
    const existing = await prisma.payoutConfig.findFirst({ where: { seasonId: data.seasonId ?? null } });
    if (existing) {
      return prisma.payoutConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.payoutConfig.create({ data });
  });
}
