import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";

export async function GET() {
  return handleRoute(() => prisma.player.findMany({ orderBy: { sortOrder: "asc" } }));
}

const createSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  return handleRoute(async () => {
    const body = createSchema.parse(await req.json());
    return prisma.player.create({ data: body });
  });
}

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: Request) {
  return handleRoute(async () => {
    const { id, ...data } = updateSchema.parse(await req.json());
    return prisma.player.update({ where: { id }, data });
  });
}
