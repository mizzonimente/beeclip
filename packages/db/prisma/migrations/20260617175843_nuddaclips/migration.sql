-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('EDUCATIONAL', 'ENTERTAINMENT', 'PROMO', 'PODCAST', 'INTERVIEW', 'VLOG', 'BACKSTAGE', 'MUSIC', 'CORPORATE', 'CREATOR');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADED', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'ANALYZING', 'RENDERING_CLIPS', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ClipFormat" AS ENUM ('VERTICAL_9_16', 'SQUARE_1_1', 'HORIZONTAL_16_9', 'VERTICAL_4_5', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CropMode" AS ENUM ('CENTER', 'SMART', 'MANUAL');

-- CreateEnum
CREATE TYPE "ClipStatus" AS ENUM ('QUEUED', 'RENDERING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('TIKTOK', 'INSTAGRAM', 'YOUTUBE_SHORTS', 'LINKEDIN', 'FACEBOOK', 'OTHER');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('OWN', 'REFERENCE');

-- CreateEnum
CREATE TYPE "ProfileConnectionType" AS ENUM ('OAUTH', 'MANUAL', 'LICENSED_PROVIDER');

-- CreateEnum
CREATE TYPE "TrendSource" AS ENUM ('MOCK', 'LICENSED_PROVIDER', 'CURATED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('VIDEO_PROCESSING', 'CLIP_EXPORT', 'TREND_REFRESH', 'SOCIAL_PROFILE_REFRESH');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthlyCents" INTEGER NOT NULL,
    "minutesPerMonth" INTEGER NOT NULL,
    "clipsPerMonth" INTEGER NOT NULL,
    "maxReferenceProfiles" INTEGER NOT NULL,
    "maxExportResolution" TEXT NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "minutesProcessed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clipsGenerated" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "contentGoal" TEXT,
    "targetAudience" TEXT,
    "contentType" "ContentType" NOT NULL DEFAULT 'CREATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "fps" DOUBLE PRECISION,
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "desiredClipCount" INTEGER,
    "avgClipDuration" INTEGER,
    "minClipDuration" INTEGER NOT NULL DEFAULT 15,
    "maxClipDuration" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'it',
    "fullText" TEXT NOT NULL,
    "segments" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipCandidate" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "hookScore" DOUBLE PRECISION NOT NULL,
    "emotionScore" DOUBLE PRECISION NOT NULL,
    "retentionScore" DOUBLE PRECISION NOT NULL,
    "pacingScore" DOUBLE PRECISION NOT NULL,
    "clarityScore" DOUBLE PRECISION NOT NULL,
    "standaloneScore" DOUBLE PRECISION NOT NULL,
    "aggregateScore" DOUBLE PRECISION NOT NULL,
    "emotionTags" TEXT[],
    "rationale" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "clipCandidateId" TEXT NOT NULL,
    "viralScore" INTEGER NOT NULL,
    "viralReasoning" TEXT NOT NULL,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "suggestedTitle" TEXT NOT NULL,
    "suggestedDescription" TEXT NOT NULL,
    "suggestedCaption" TEXT NOT NULL,
    "suggestedHook" TEXT NOT NULL,
    "suggestedOverlayText" TEXT NOT NULL,
    "suggestedCoverHint" TEXT NOT NULL,
    "hashtags" TEXT[],
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "clipCandidateId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" "ClipFormat" NOT NULL,
    "cropMode" "CropMode" NOT NULL DEFAULT 'SMART',
    "customCrop" JSONB,
    "storageKey" TEXT,
    "thumbnailKey" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "status" "ClipStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "format" "ClipFormat" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProfileType" NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "connectedVia" "ProfileConnectionType" NOT NULL DEFAULT 'MANUAL',
    "toneOfVoice" TEXT,
    "recurringFormats" JSONB,
    "hashtagsUsed" TEXT[],
    "visualStyle" TEXT,
    "postingFrequency" TEXT,
    "avgEngagementRate" DOUBLE PRECISION,
    "bestPerformingContent" JSONB,
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendSnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "trendingSounds" JSONB NOT NULL,
    "emergingHashtags" TEXT[],
    "viralFormats" JSONB NOT NULL,
    "growingNiches" TEXT[],
    "source" "TrendSource" NOT NULL DEFAULT 'MOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "trendSnapshotId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "videoId" TEXT,
    "refId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_periodStart_key" ON "UsageCounter"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_videoId_key" ON "Transcript"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_clipCandidateId_key" ON "AnalysisResult"("clipCandidateId");

-- CreateIndex
CREATE INDEX "Clip_status_idx" ON "Clip"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrendSnapshot_date_platform_key" ON "TrendSnapshot"("date", "platform");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipCandidate" ADD CONSTRAINT "ClipCandidate_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_clipCandidateId_fkey" FOREIGN KEY ("clipCandidateId") REFERENCES "ClipCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_clipCandidateId_fkey" FOREIGN KEY ("clipCandidateId") REFERENCES "ClipCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_trendSnapshotId_fkey" FOREIGN KEY ("trendSnapshotId") REFERENCES "TrendSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
