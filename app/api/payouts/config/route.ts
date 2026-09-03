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
    // Confirmed with the group: $15/week, $150 season-long pot decided by regular-season
    // standings through week 18 (the postseason is a separate competition, not part of this).
    return prisma.payoutConfig.create({
      data: {
        seasonId: seasonId ?? undefined,
        weeklyPotAmount: 15,
        seasonPotAmount: 150,
        seasonEndsAtWeek: 18,
        structure: "winner_take_all",
      },
    });
  });
}

const schema = z.object({
  seasonId: z.string().optional(),
  weeklyPotAmount: z.number().min(0).optional(),
  seasonPotAmount: z.number().min(0).optional(),
  seasonEndsAtWeek: z.number().int().min(1).optional(),
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
