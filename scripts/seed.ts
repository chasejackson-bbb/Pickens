import { prisma } from "../lib/prisma";
import { seedDatabase } from "../lib/setup";

seedDatabase()
  .then((log) => {
    log.forEach((line) => console.log(line));
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
