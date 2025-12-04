-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('FRESH', 'STALE', 'BACKFILLING', 'ERROR');

-- CreateEnum
CREATE TYPE "ArtistRole" AS ENUM ('PRIMARY', 'FEATURED');

-- CreateEnum
CREATE TYPE "BackfillStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "catalogStatus" "CatalogStatus" NOT NULL DEFAULT 'STALE',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "lastBackfillAt" TIMESTAMP(3),
ADD COLUMN     "subscribers" TEXT,
ADD COLUMN     "trackCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CanonicalTrack" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "duration" INTEGER,
    "releaseYear" INTEGER,
    "releaseDate" TIMESTAMP(3),
    "language" TEXT,
    "thumbnailUrl" TEXT,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "albumId" TEXT,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationSource" TEXT NOT NULL DEFAULT 'youtube',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalAlbum" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "releaseYear" INTEGER,
    "albumType" TEXT NOT NULL DEFAULT 'ALBUM',
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistCatalog" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "role" "ArtistRole" NOT NULL DEFAULT 'PRIMARY',
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationSource" TEXT NOT NULL DEFAULT 'youtube',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ArtistCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackfillJob" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "status" "BackfillStatus" NOT NULL DEFAULT 'PENDING',
    "totalAlbums" INTEGER NOT NULL DEFAULT 0,
    "processedAlbums" INTEGER NOT NULL DEFAULT 0,
    "tracksValidated" INTEGER NOT NULL DEFAULT 0,
    "tracksRejected" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedAlbumId" TEXT,
    "checkpoint" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackfillJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalTrack_videoId_key" ON "CanonicalTrack"("videoId");

-- CreateIndex
CREATE INDEX "CanonicalTrack_title_idx" ON "CanonicalTrack"("title");

-- CreateIndex
CREATE INDEX "CanonicalTrack_normalizedTitle_idx" ON "CanonicalTrack"("normalizedTitle");

-- CreateIndex
CREATE INDEX "CanonicalTrack_releaseYear_idx" ON "CanonicalTrack"("releaseYear");

-- CreateIndex
CREATE INDEX "CanonicalTrack_popularity_idx" ON "CanonicalTrack"("popularity" DESC);

-- CreateIndex
CREATE INDEX "CanonicalTrack_albumId_idx" ON "CanonicalTrack"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalAlbum_albumId_key" ON "CanonicalAlbum"("albumId");

-- CreateIndex
CREATE INDEX "CanonicalAlbum_artistId_idx" ON "CanonicalAlbum"("artistId");

-- CreateIndex
CREATE INDEX "CanonicalAlbum_releaseYear_idx" ON "CanonicalAlbum"("releaseYear");

-- CreateIndex
CREATE INDEX "CanonicalAlbum_name_idx" ON "CanonicalAlbum"("name");

-- CreateIndex
CREATE INDEX "ArtistCatalog_artistId_isActive_idx" ON "ArtistCatalog"("artistId", "isActive");

-- CreateIndex
CREATE INDEX "ArtistCatalog_artistId_role_idx" ON "ArtistCatalog"("artistId", "role");

-- CreateIndex
CREATE INDEX "ArtistCatalog_trackId_idx" ON "ArtistCatalog"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistCatalog_artistId_trackId_key" ON "ArtistCatalog"("artistId", "trackId");

-- CreateIndex
CREATE INDEX "BackfillJob_artistId_idx" ON "BackfillJob"("artistId");

-- CreateIndex
CREATE INDEX "BackfillJob_status_idx" ON "BackfillJob"("status");

-- CreateIndex
CREATE INDEX "BackfillJob_createdAt_idx" ON "BackfillJob"("createdAt");

-- CreateIndex
CREATE INDEX "Artist_catalogStatus_idx" ON "Artist"("catalogStatus");

-- AddForeignKey
ALTER TABLE "CanonicalTrack" ADD CONSTRAINT "CanonicalTrack_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "CanonicalAlbum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalAlbum" ADD CONSTRAINT "CanonicalAlbum_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistCatalog" ADD CONSTRAINT "ArtistCatalog_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistCatalog" ADD CONSTRAINT "ArtistCatalog_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "CanonicalTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillJob" ADD CONSTRAINT "BackfillJob_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
