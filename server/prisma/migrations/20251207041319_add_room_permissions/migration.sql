-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "canAddQueue" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canControlPlayback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageQueue" BOOLEAN NOT NULL DEFAULT false;
