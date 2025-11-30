-- CreateTable
CREATE TABLE "UserSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackFeature" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "bpm" DOUBLE PRECISION,
    "energy" DOUBLE PRECISION,
    "danceability" DOUBLE PRECISION,
    "acousticness" DOUBLE PRECISION,
    "instrumentalness" DOUBLE PRECISION,
    "valence" DOUBLE PRECISION,
    "genres" TEXT[],
    "moods" TEXT[],
    "instruments" TEXT[],
    "embedding" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "ContextLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSignal_userId_type_idx" ON "UserSignal"("userId", "type");

-- CreateIndex
CREATE INDEX "UserSignal_trackId_idx" ON "UserSignal"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackFeature_trackId_key" ON "TrackFeature"("trackId");

-- AddForeignKey
ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackFeature" ADD CONSTRAINT "TrackFeature_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextLog" ADD CONSTRAINT "ContextLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
