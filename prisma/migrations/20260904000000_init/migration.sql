-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Week" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "isPostseason" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "mechanic" TEXT NOT NULL DEFAULT 'ats',
    "picksPerPlayer" INTEGER,
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "kickoff" TIMESTAMP(3),
    "homeSpread" DOUBLE PRECISION,
    "finalHomeScore" INTEGER,
    "finalAwayScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "oddsApiEventId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT,
    "teamPicked" TEXT NOT NULL,
    "lockedSpread" DOUBLE PRECISION,
    "draftOrderPosition" INTEGER,
    "pickedAt" TIMESTAMP(3),
    "result" TEXT NOT NULL DEFAULT 'pending',
    "points" DOUBLE PRECISION,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "isHistoricalImport" BOOLEAN NOT NULL DEFAULT false,
    "sourceRound" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiebreakerGuess" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "guessValue" DOUBLE PRECISION,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TiebreakerGuess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TiebreakerConfig" (
    "weekId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL DEFAULT 'George Pickens',
    "statType" TEXT NOT NULL DEFAULT 'receiving_yards',
    "actualValue" DOUBLE PRECISION,

    CONSTRAINT "TiebreakerConfig_pkey" PRIMARY KEY ("weekId")
);

-- CreateTable
CREATE TABLE "DraftOrder" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "order" TEXT NOT NULL,
    "manuallyOverridden" BOOLEAN NOT NULL DEFAULT false,
    "randomizedAt" TIMESTAMP(3),

    CONSTRAINT "DraftOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "weekId" TEXT,
    "seasonId" TEXT,
    "playerId" TEXT NOT NULL,
    "amountOwed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountWon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutConfig" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "weeklyPotAmount" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "seasonPotAmount" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "seasonEndsAtWeek" INTEGER NOT NULL DEFAULT 18,
    "structure" TEXT NOT NULL DEFAULT 'winner_take_all',
    "splitFirst" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "splitSecond" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "splitThird" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,

    CONSTRAINT "TeamAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Season_year_key" ON "Season"("year");

-- CreateIndex
CREATE INDEX "Week_seasonId_idx" ON "Week"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Week_seasonId_weekNumber_label_key" ON "Week"("seasonId", "weekNumber", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Game_oddsApiEventId_key" ON "Game"("oddsApiEventId");

-- CreateIndex
CREATE INDEX "Game_weekId_idx" ON "Game"("weekId");

-- CreateIndex
CREATE INDEX "Pick_weekId_idx" ON "Pick"("weekId");

-- CreateIndex
CREATE INDEX "Pick_playerId_idx" ON "Pick"("playerId");

-- CreateIndex
CREATE INDEX "Pick_gameId_idx" ON "Pick"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "TiebreakerGuess_weekId_playerId_key" ON "TiebreakerGuess"("weekId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftOrder_weekId_key" ON "DraftOrder"("weekId");

-- CreateIndex
CREATE INDEX "Payout_weekId_idx" ON "Payout"("weekId");

-- CreateIndex
CREATE INDEX "Payout_seasonId_idx" ON "Payout"("seasonId");

-- CreateIndex
CREATE INDEX "Payout_playerId_idx" ON "Payout"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAlias_alias_key" ON "TeamAlias"("alias");

-- CreateIndex
CREATE INDEX "TeamAlias_canonical_idx" ON "TeamAlias"("canonical");

-- AddForeignKey
ALTER TABLE "Week" ADD CONSTRAINT "Week_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiebreakerGuess" ADD CONSTRAINT "TiebreakerGuess_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiebreakerGuess" ADD CONSTRAINT "TiebreakerGuess_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiebreakerConfig" ADD CONSTRAINT "TiebreakerConfig_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutConfig" ADD CONSTRAINT "PayoutConfig_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

