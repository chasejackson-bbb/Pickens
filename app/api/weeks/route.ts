import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute, jsonError } from "@/lib/api-helpers";
import { getWeekDetail } from "@/lib/queries";

export async function GET(req: Request) {
  return handleRoute(() => {
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("seasonId") ?? undefined;
    return prisma.week.findMany({
      where: seasonId ? { seasonId } : undefined,
      orderBy: [{ seasonId: "desc" }, { weekNumber: "asc" }],
      include: { season: true, games: true, _count: { select: { picks: true } } },
    });
  });
}

const createSchema = z.object({
  seasonId: z.string(),
  weekNumber: z.number().int(),
  label: z.string().optional(),
  isPostseason: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handleRoute(async () => {
    const data = createSchema.parse(await req.json());
    const week = await prisma.week.create({
      data: {
        seasonId: data.seasonId,
        weekNumber: data.weekNumber,
        label: data.label ?? "",
        isPostseason: data.isPostseason ?? false,
        status: "upcoming",
      },
    });
    return getWeekDetail(week.id);
  });
}
