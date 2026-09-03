import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { NFL_TEAMS } from "@/lib/teams";

export async function GET() {
  return handleRoute(() => prisma.teamAlias.findMany({ orderBy: { alias: "asc" } }));
}

const schema = z.object({
  alias: z.string().min(1),
  canonical: z.enum(NFL_TEAMS as unknown as [string, ...string[]]),
});

/** Add or update an alias without a code deploy (e.g. a new nickname someone starts using). */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const { alias, canonical } = schema.parse(await req.json());
    const key = alias.trim().toLowerCase();
    return prisma.teamAlias.upsert({
      where: { alias: key },
      update: { canonical },
      create: { alias: key, canonical },
    });
  });
}
