-- AlterTable
ALTER TABLE "public"."AddonItem" ADD COLUMN     "code" VARCHAR(64);

-- CreateTable
CREATE TABLE "public"."ExamOverride" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "examId" VARCHAR(128) NOT NULL,
    "code" VARCHAR(64),
    "sexCode" VARCHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamOverride_hospitalId_code_idx" ON "public"."ExamOverride"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ExamOverride_hospitalId_examId_key" ON "public"."ExamOverride"("hospitalId", "examId");

-- CreateIndex
CREATE INDEX "AddonItem_hospitalId_code_idx" ON "public"."AddonItem"("hospitalId", "code");

-- AddForeignKey
ALTER TABLE "public"."ExamOverride" ADD CONSTRAINT "ExamOverride_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
