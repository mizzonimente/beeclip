-- CreateEnum
CREATE TYPE "VideoSourceType" AS ENUM ('FILE_UPLOAD', 'DRIVE_LINK');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN "sourceType" "VideoSourceType" NOT NULL DEFAULT 'FILE_UPLOAD',
ADD COLUMN "sourceUrl" TEXT;
