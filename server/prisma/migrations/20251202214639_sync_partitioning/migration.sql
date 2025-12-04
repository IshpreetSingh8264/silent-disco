/*
  Warnings:

  - The `status` column on the `Friendship` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `ContextLog_old` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ListeningHistory_old` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserSignal_old` table. If the table is not empty, all the data it contains will be lost.
  - The required column `id` was added to the `Friendship` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "ContextLog_old" DROP CONSTRAINT "ContextLog_old_userId_fkey";

-- DropForeignKey
ALTER TABLE "ListeningHistory_old" DROP CONSTRAINT "ListeningHistory_old_trackId_fkey";

-- DropForeignKey
ALTER TABLE "ListeningHistory_old" DROP CONSTRAINT "ListeningHistory_old_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSignal_old" DROP CONSTRAINT "UserSignal_old_trackId_fkey";

-- DropForeignKey
ALTER TABLE "UserSignal_old" DROP CONSTRAINT "UserSignal_old_userId_fkey";

-- AlterTable
ALTER TABLE "Friendship" ADD COLUMN     "id" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
ADD CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "ContextLog_old";

-- DropTable
DROP TABLE "ListeningHistory_old";

-- DropTable
DROP TABLE "UserSignal_old";

-- CreateIndex
CREATE INDEX "Friendship_userId_status_idx" ON "Friendship"("userId", "status");

-- CreateIndex
CREATE INDEX "Friendship_friendId_status_idx" ON "Friendship"("friendId", "status");

-- CreateIndex
CREATE INDEX "TrackFeature_bpm_idx" ON "TrackFeature"("bpm");

-- CreateIndex
CREATE INDEX "TrackFeature_energy_idx" ON "TrackFeature"("energy");

-- CreateIndex
CREATE INDEX "TrackFeature_danceability_idx" ON "TrackFeature"("danceability");
