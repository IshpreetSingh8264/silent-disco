-- AlterTable
ALTER TABLE "ListeningHistory" ADD COLUMN     "durationPlayed" INTEGER;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "globalPlayCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrackStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTrackStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackRegionStats" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackRegionStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserQueue_userId_position_idx" ON "UserQueue"("userId", "position");

-- CreateIndex
CREATE INDEX "UserTrackStats_userId_playCount_idx" ON "UserTrackStats"("userId", "playCount" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserTrackStats_userId_trackId_key" ON "UserTrackStats"("userId", "trackId");

-- CreateIndex
CREATE INDEX "TrackRegionStats_countryCode_trendingScore_idx" ON "TrackRegionStats"("countryCode", "trendingScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TrackRegionStats_trackId_countryCode_key" ON "TrackRegionStats"("trackId", "countryCode");

-- AddForeignKey
ALTER TABLE "UserQueue" ADD CONSTRAINT "UserQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQueue" ADD CONSTRAINT "UserQueue_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrackStats" ADD CONSTRAINT "UserTrackStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrackStats" ADD CONSTRAINT "UserTrackStats_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackRegionStats" ADD CONSTRAINT "TrackRegionStats_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
