import { prisma } from "../lib/prisma";
import { TEAM_ALIASES } from "../lib/teams";

async function main() {
  const players = ["Blake", "Jay", "Chase"];
  for (let i = 0; i < players.length; i++) {
    await prisma.player.upsert({
      where: { name: players[i] },
      update: {},
      create: { name: players[i], sortOrder: i },
    });
  }
  console.log(`Seeded ${players.length} players.`);

  let aliasCount = 0;
  for (const [alias, canonical] of Object.entries(TEAM_ALIASES)) {
    await prisma.teamAlias.upsert({ where: { alias }, update: { canonical }, create: { alias, canonical } });
    aliasCount++;
  }
  console.log(`Seeded ${aliasCount} team aliases.`);

  const existingConfig = await prisma.payoutConfig.findFirst({ where: { seasonId: null } });
  if (!existingConfig) {
    await prisma.payoutConfig.create({
      data: {
        weeklyPotAmount: 15,
        seasonPotAmount: 150,
        seasonEndsAtWeek: 18,
        structure: "winner_take_all",
        notes:
          "Confirmed with the group: $15/week, $150 season-long pot decided by regular-season standings through week 18. The postseason is a separate competition, not part of this pot.",
      },
    });
    console.log("Seeded default payout config ($15/week, $150/season through week 18, winner-take-all).");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
