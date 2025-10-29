-- DropIndex
DROP INDEX "public"."Booking_hospitalId_phoneNormalized_idx";

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "effective_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."CapacitySetting" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "defaults" JSONB NOT NULL DEFAULT '{}',
    "examDefaults" JSONB NOT NULL DEFAULT '{}',
    "specials" JSONB NOT NULL DEFAULT '{}',
    "managed" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacitySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapacitySetting_hospitalId_key" ON "public"."CapacitySetting"("hospitalId");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_effective_date_idx" ON "public"."Booking"("hospitalId", "effective_date");

-- AddForeignKey
ALTER TABLE "public"."CapacitySetting" ADD CONSTRAINT "CapacitySetting_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
