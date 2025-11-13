-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "amendedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "requestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_hospitalId_createdAt_idx" ON "public"."Booking"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_packageId_createdAt_idx" ON "public"."Booking"("hospitalId", "packageId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_companyId_createdAt_idx" ON "public"."Booking"("hospitalId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_status_createdAt_idx" ON "public"."Booking"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_sex_createdAt_idx" ON "public"."Booking"("hospitalId", "sex", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_requestedAt_idx" ON "public"."Booking"("hospitalId", "requestedAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_confirmedAt_idx" ON "public"."Booking"("hospitalId", "confirmedAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_amendedAt_idx" ON "public"."Booking"("hospitalId", "amendedAt");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_completedAt_idx" ON "public"."Booking"("hospitalId", "completedAt");
