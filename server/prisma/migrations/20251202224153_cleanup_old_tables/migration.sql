/*
  Warnings:

  - You are about to drop the `ContextLog_old` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ListeningHistory_old` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserSignal_old` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ContextLog_old" DROP CONSTRAINT "ContextLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "ListeningHistory_old" DROP CONSTRAINT "ListeningHistory_trackId_fkey";

-- DropForeignKey
ALTER TABLE "ListeningHistory_old" DROP CONSTRAINT "ListeningHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSignal_old" DROP CONSTRAINT "UserSignal_trackId_fkey";

-- DropForeignKey
ALTER TABLE "UserSignal_old" DROP CONSTRAINT "UserSignal_userId_fkey";

-- DropTable
DROP TABLE "ContextLog_old";

-- DropTable
DROP TABLE "ListeningHistory_old";

-- DropTable
DROP TABLE "UserSignal_old";

-- CreateIndex
CREATE INDEX "ContextLog_userId_timestamp_idx" ON "ContextLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "ContextLog_timestamp_idx" ON "ContextLog"("timestamp");

-- CreateIndex
CREATE INDEX "ListeningHistory_userId_playedAt_idx" ON "ListeningHistory"("userId", "playedAt");

-- CreateIndex
CREATE INDEX "ListeningHistory_trackId_playedAt_idx" ON "ListeningHistory"("trackId", "playedAt");

-- CreateIndex
CREATE INDEX "ListeningHistory_playedAt_idx" ON "ListeningHistory"("playedAt");

-- CreateIndex
CREATE INDEX "UserSignal_userId_type_createdAt_idx" ON "UserSignal"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "UserSignal_trackId_type_createdAt_idx" ON "UserSignal"("trackId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "UserSignal_createdAt_idx" ON "UserSignal"("createdAt");

-- AddForeignKey
ALTER TABLE "ListeningHistory" ADD CONSTRAINT "ListeningHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningHistory" ADD CONSTRAINT "ListeningHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextLog" ADD CONSTRAINT "ContextLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
