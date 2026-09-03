import { prisma } from "./prisma";
import { normalizeTeam, type NflTeam } from "./teams";

// Server-only: checks admin-added aliases (app/api/team-aliases) in the DB before falling
// back to the compiled-in static table in lib/teams.ts. Kept out of lib/teams.ts so that
// file stays safe to import from client components (no Prisma in the browser bundle).
export async function resolveTeamAlias(raw: string | null | undefined): Promise<NflTeam | null> {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const dbHit = await prisma.teamAlias.findUnique({ where: { alias: key } });
  if (dbHit) return dbHit.canonical as NflTeam;
  return normalizeTeam(raw);
}
