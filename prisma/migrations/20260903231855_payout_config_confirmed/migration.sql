-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PayoutConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT,
    "weeklyPotAmount" REAL NOT NULL DEFAULT 15,
    "seasonPotAmount" REAL NOT NULL DEFAULT 150,
    "seasonEndsAtWeek" INTEGER NOT NULL DEFAULT 18,
    "structure" TEXT NOT NULL DEFAULT 'winner_take_all',
    "splitFirst" REAL NOT NULL DEFAULT 1.0,
    "splitSecond" REAL NOT NULL DEFAULT 0,
    "splitThird" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayoutConfig_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PayoutConfig" ("id", "notes", "seasonId", "seasonPotAmount", "splitFirst", "splitSecond", "splitThird", "structure", "updatedAt", "weeklyPotAmount") SELECT "id", "notes", "seasonId", "seasonPotAmount", "splitFirst", "splitSecond", "splitThird", "structure", "updatedAt", "weeklyPotAmount" FROM "PayoutConfig";
DROP TABLE "PayoutConfig";
ALTER TABLE "new_PayoutConfig" RENAME TO "PayoutConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
