-- AlterEnum
ALTER TYPE "public"."BookingStatus" ADD VALUE 'AMENDED';

-- CreateTable
CREATE TABLE "public"."BookingChangeLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "actor" TEXT,
    "diff" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingChangeLog_bookingId_createdAt_idx" ON "public"."BookingChangeLog"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."BookingChangeLog" ADD CONSTRAINT "BookingChangeLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
