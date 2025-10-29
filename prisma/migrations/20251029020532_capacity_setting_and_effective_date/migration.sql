-- AlterTable
ALTER TABLE "public"."CapacitySetting" ALTER COLUMN "defaults" DROP DEFAULT,
ALTER COLUMN "examDefaults" DROP DEFAULT,
ALTER COLUMN "specials" DROP DEFAULT,
ALTER COLUMN "managed" DROP DEFAULT;
