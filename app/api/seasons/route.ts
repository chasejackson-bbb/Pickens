import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";

export async function GET() {
  return handleRoute(() =>
    prisma.season.findMany({ orderBy: { year: "desc" }, include: { weeks: { select: { id: true, weekNumber: true, label: true, status: true } } } })
  );
}

const createSchema = z.object({ year: z.number().int() });

export async function POST(req: Request) {
  return handleRoute(async () => {
    const { year } = createSchema.parse(await req.json());
    return prisma.season.upsert({ where: { year }, update: {}, create: { year } });
  });
}
