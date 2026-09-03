import { prisma } from "@/lib/prisma";
import { getWeekResult } from "@/lib/queries";
import { WeekBoard } from "./WeekBoard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WeekPage({ params }: { params: { weekId: string } }) {
  const result = await getWeekResult(params.weekId);
  if (!result) notFound();

  const players = await prisma.player.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

  return <WeekBoard weekId={params.weekId} initial={JSON.parse(JSON.stringify(result))} players={players} />;
}
