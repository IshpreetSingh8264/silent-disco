-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('SKIP', 'LIKE', 'DWELL', 'VOLUME', 'CLICK', 'SEARCH', 'OTHER');

-- CreateEnum
CREATE TYPE "QueueSource" AS ENUM ('MANUAL', 'SYSTEM', 'AI');

-- AlterTable
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_pkey",
DROP COLUMN "id";

-- AlterTable
ALTER TABLE "RoomQueue" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT;

-- MANUAL PARTITIONING START

-- ListeningHistory
ALTER TABLE "ListeningHistory" RENAME TO "ListeningHistory_old";
ALTER TABLE "ListeningHistory_old" RENAME CONSTRAINT "ListeningHistory_pkey" TO "ListeningHistory_old_pkey";
ALTER INDEX IF EXISTS "ListeningHistory_userId_playedAt_idx" RENAME TO "ListeningHistory_old_userId_playedAt_idx";
ALTER INDEX IF EXISTS "ListeningHistory_trackId_playedAt_idx" RENAME TO "ListeningHistory_old_trackId_playedAt_idx";
ALTER INDEX IF EXISTS "ListeningHistory_playedAt_idx" RENAME TO "ListeningHistory_old_playedAt_idx";
ALTER TABLE "ListeningHistory_old" RENAME CONSTRAINT "ListeningHistory_userId_fkey" TO "ListeningHistory_old_userId_fkey";
ALTER TABLE "ListeningHistory_old" RENAME CONSTRAINT "ListeningHistory_trackId_fkey" TO "ListeningHistory_old_trackId_fkey";

CREATE TABLE "ListeningHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationPlayed" INTEGER,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningHistory_pkey" PRIMARY KEY ("id", "playedAt")
) PARTITION BY RANGE ("playedAt");

CREATE TABLE "ListeningHistory_2024" PARTITION OF "ListeningHistory" FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE "ListeningHistory_2025" PARTITION OF "ListeningHistory" FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE "ListeningHistory_2026" PARTITION OF "ListeningHistory" FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- UserSignal
ALTER TABLE "UserSignal" RENAME TO "UserSignal_old";
ALTER TABLE "UserSignal_old" RENAME CONSTRAINT "UserSignal_pkey" TO "UserSignal_old_pkey";
ALTER INDEX IF EXISTS "UserSignal_userId_type_idx" RENAME TO "UserSignal_old_userId_type_idx";
ALTER INDEX IF EXISTS "UserSignal_trackId_idx" RENAME TO "UserSignal_old_trackId_idx";
ALTER TABLE "UserSignal_old" RENAME CONSTRAINT "UserSignal_userId_fkey" TO "UserSignal_old_userId_fkey";
ALTER TABLE "UserSignal_old" RENAME CONSTRAINT "UserSignal_trackId_fkey" TO "UserSignal_old_trackId_fkey";

CREATE TABLE "UserSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "value" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSignal_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

CREATE TABLE "UserSignal_2024" PARTITION OF "UserSignal" FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE "UserSignal_2025" PARTITION OF "UserSignal" FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE "UserSignal_2026" PARTITION OF "UserSignal" FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- ContextLog
ALTER TABLE "ContextLog" RENAME TO "ContextLog_old";
ALTER TABLE "ContextLog_old" RENAME CONSTRAINT "ContextLog_pkey" TO "ContextLog_old_pkey";
ALTER TABLE "ContextLog_old" RENAME CONSTRAINT "ContextLog_userId_fkey" TO "ContextLog_old_userId_fkey";

CREATE TABLE "ContextLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationType" TEXT,
    "deviceType" TEXT,
    "networkType" TEXT,
    "timeOfDay" TEXT,
    "dayOfWeek" TEXT,
    "weather" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ContextLog_pkey" PRIMARY KEY ("id", "timestamp")
) PARTITION BY RANGE ("timestamp");

CREATE TABLE "ContextLog_2024" PARTITION OF "ContextLog" FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE "ContextLog_2025" PARTITION OF "ContextLog" FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE "ContextLog_2026" PARTITION OF "ContextLog" FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Indexes for new tables
CREATE INDEX "ListeningHistory_userId_playedAt_idx" ON "ListeningHistory"("userId", "playedAt");
CREATE INDEX "ListeningHistory_trackId_playedAt_idx" ON "ListeningHistory"("trackId", "playedAt");
CREATE INDEX "ListeningHistory_playedAt_idx" ON "ListeningHistory"("playedAt");

CREATE INDEX "UserSignal_userId_type_createdAt_idx" ON "UserSignal"("userId", "type", "createdAt");
CREATE INDEX "UserSignal_trackId_type_createdAt_idx" ON "UserSignal"("trackId", "type", "createdAt");
CREATE INDEX "UserSignal_createdAt_idx" ON "UserSignal"("createdAt");

CREATE INDEX "ContextLog_userId_timestamp_idx" ON "ContextLog"("userId", "timestamp");
CREATE INDEX "ContextLog_timestamp_idx" ON "ContextLog"("timestamp");

-- Foreign Keys for new tables
ALTER TABLE "ListeningHistory" ADD CONSTRAINT "ListeningHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListeningHistory" ADD CONSTRAINT "ListeningHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContextLog" ADD CONSTRAINT "ContextLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MANUAL PARTITIONING END

-- CreateIndex
CREATE INDEX "LikedTrack_userId_idx" ON "LikedTrack"("userId");

-- CreateIndex
CREATE INDEX "LikedTrack_trackId_idx" ON "LikedTrack"("trackId");

-- CreateIndex
CREATE INDEX "Playlist_userId_idx" ON "Playlist"("userId");

-- CreateIndex
CREATE INDEX "PlaylistTrack_playlistId_order_idx" ON "PlaylistTrack"("playlistId", "order");

-- CreateIndex
CREATE INDEX "PlaylistTrack_trackId_idx" ON "PlaylistTrack"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistTrack_playlistId_trackId_key" ON "PlaylistTrack"("playlistId", "trackId");

-- CreateIndex
CREATE INDEX "Room_hostId_idx" ON "Room"("hostId");

-- CreateIndex
CREATE INDEX "Room_updatedAt_idx" ON "Room"("updatedAt");

-- CreateIndex
CREATE INDEX "RoomMember_roomId_idx" ON "RoomMember"("roomId");

-- CreateIndex
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");

-- CreateIndex
CREATE INDEX "RoomQueue_roomId_order_idx" ON "RoomQueue"("roomId", "order");

-- CreateIndex
CREATE INDEX "RoomQueue_trackId_idx" ON "RoomQueue"("trackId");

-- CreateIndex
CREATE INDEX "RoomQueue_createdAt_idx" ON "RoomQueue"("createdAt");

-- CreateIndex
CREATE INDEX "Track_title_idx" ON "Track"("title");

-- CreateIndex
CREATE INDEX "Track_artist_idx" ON "Track"("artist");

-- CreateIndex
CREATE INDEX "Track_globalPlayCount_idx" ON "Track"("globalPlayCount");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
