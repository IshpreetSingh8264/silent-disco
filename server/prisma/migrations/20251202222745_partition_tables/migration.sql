-- Rename existing tables safely
DO $$
BEGIN
    IF EXISTS(SELECT * FROM information_schema.tables WHERE table_name = 'ListeningHistory') THEN
        ALTER TABLE "ListeningHistory" RENAME TO "ListeningHistory_old";
    END IF;
    IF EXISTS(SELECT * FROM information_schema.tables WHERE table_name = 'UserSignal') THEN
        ALTER TABLE "UserSignal" RENAME TO "UserSignal_old";
    END IF;
    IF EXISTS(SELECT * FROM information_schema.tables WHERE table_name = 'ContextLog') THEN
        ALTER TABLE "ContextLog" RENAME TO "ContextLog_old";
    END IF;
END $$;

-- Create partitioned tables
-- ListeningHistory
CREATE TABLE IF NOT EXISTS "ListeningHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationPlayed" INTEGER,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningHistory_partitioned_pkey" PRIMARY KEY ("id", "playedAt")
) PARTITION BY RANGE ("playedAt");

-- UserSignal
CREATE TABLE IF NOT EXISTS "UserSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "value" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSignal_partitioned_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- ContextLog
CREATE TABLE IF NOT EXISTS "ContextLog" (
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

    CONSTRAINT "ContextLog_partitioned_pkey" PRIMARY KEY ("id", "timestamp")
) PARTITION BY RANGE ("timestamp");

-- Create Partitions
CREATE TABLE IF NOT EXISTS "ListeningHistory_2024" PARTITION OF "ListeningHistory" FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS "ListeningHistory_2025" PARTITION OF "ListeningHistory" FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS "ListeningHistory_default" PARTITION OF "ListeningHistory" DEFAULT;

CREATE TABLE IF NOT EXISTS "UserSignal_2024" PARTITION OF "UserSignal" FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS "UserSignal_2025" PARTITION OF "UserSignal" FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS "UserSignal_default" PARTITION OF "UserSignal" DEFAULT;

CREATE TABLE IF NOT EXISTS "ContextLog_2024" PARTITION OF "ContextLog" FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS "ContextLog_2025" PARTITION OF "ContextLog" FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS "ContextLog_default" PARTITION OF "ContextLog" DEFAULT;

-- Add Indexes
CREATE INDEX IF NOT EXISTS "ListeningHistory_userId_playedAt_idx" ON "ListeningHistory"("userId", "playedAt");
CREATE INDEX IF NOT EXISTS "ListeningHistory_trackId_playedAt_idx" ON "ListeningHistory"("trackId", "playedAt");
CREATE INDEX IF NOT EXISTS "ListeningHistory_playedAt_idx" ON "ListeningHistory"("playedAt");

CREATE INDEX IF NOT EXISTS "UserSignal_userId_type_createdAt_idx" ON "UserSignal"("userId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "UserSignal_trackId_type_createdAt_idx" ON "UserSignal"("trackId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "UserSignal_createdAt_idx" ON "UserSignal"("createdAt");

CREATE INDEX IF NOT EXISTS "ContextLog_userId_timestamp_idx" ON "ContextLog"("userId", "timestamp");
CREATE INDEX IF NOT EXISTS "ContextLog_timestamp_idx" ON "ContextLog"("timestamp");

-- Restore Foreign Keys safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ListeningHistory_userId_fkey') THEN
        ALTER TABLE "ListeningHistory" ADD CONSTRAINT "ListeningHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ListeningHistory_trackId_fkey') THEN
        ALTER TABLE "ListeningHistory" ADD CONSTRAINT "ListeningHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSignal_userId_fkey') THEN
        ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSignal_trackId_fkey') THEN
        ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContextLog_userId_fkey') THEN
        ALTER TABLE "ContextLog" ADD CONSTRAINT "ContextLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;