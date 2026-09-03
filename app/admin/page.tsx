import { prisma } from "@/lib/prisma";
import { AdminClient } from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const players = await prisma.player.findMany({ orderBy: { sortOrder: "asc" } });
  const aliases = await prisma.teamAlias.findMany({ orderBy: { alias: "asc" } });
  return <AdminClient initialPlayers={JSON.parse(JSON.stringify(players))} aliases={JSON.parse(JSON.stringify(aliases))} />;
}
