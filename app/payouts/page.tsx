import { prisma } from "@/lib/prisma";
import { PayoutsClient } from "./PayoutsClient";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const seasons = await prisma.season.findMany({ orderBy: { year: "desc" } });
  const players = await prisma.player.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const payouts = await prisma.payout.findMany({
    include: { player: true, week: true, season: true },
    orderBy: { createdAt: "desc" },
  });
  const config = await prisma.payoutConfig.findFirst({ where: { seasonId: null } });

  return (
    <PayoutsClient
      seasons={seasons.map((s) => ({ id: s.id, year: s.year }))}
      players={players}
      initialPayouts={JSON.parse(JSON.stringify(payouts))}
      initialConfig={
        config
          ? JSON.parse(JSON.stringify(config))
          : {
              weeklyPotAmount: 15,
              seasonPotAmount: 150,
              seasonEndsAtWeek: 18,
              structure: "winner_take_all",
              splitFirst: 1,
              splitSecond: 0,
              splitThird: 0,
            }
      }
    />
  );
}
