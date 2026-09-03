import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { PAYOUT_SCOPES } from "@/lib/constants";

export async function GET(req: Request) {
  return handleRoute(() => {
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("seasonId") ?? undefined;
    return prisma.payout.findMany({
      where: seasonId ? { seasonId } : undefined,
      include: { player: true, week: true, season: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

const createSchema = z.object({
  scope: z.enum(PAYOUT_SCOPES),
  weekId: z.string().optional(),
  seasonId: z.string().optional(),
  playerId: z.string(),
  amountOwed: z.number().default(0),
  amountWon: z.number().default(0),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  return handleRoute(async () => {
    const data = createSchema.parse(await req.json());
    return prisma.payout.create({ data });
  });
}

const settleSchema = z.object({ id: z.string(), settled: z.boolean() });

export async function PATCH(req: Request) {
  return handleRoute(async () => {
    const { id, settled } = settleSchema.parse(await req.json());
    return prisma.payout.update({ where: { id }, data: { settled } });
  });
}
