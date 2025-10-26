/*
  Warnings:

  - A unique constraint covering the columns `[hospitalId,code]` on the table `Package` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hospitalId,slug]` on the table `Package` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hospitalId,idempotencyKey]` on the table `Package` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - The required column `code` was added to the `Package` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `hospitalId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_hospitalId_fkey";

-- DropIndex
DROP INDEX "public"."User_email_idx";

-- AlterTable
ALTER TABLE "public"."Package" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "idempotencyKey" VARCHAR(64),
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "hospitalId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Package_hospitalId_code_key" ON "public"."Package"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Package_hospitalId_slug_key" ON "public"."Package"("hospitalId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Package_hospitalId_idempotencyKey_key" ON "public"."Package"("hospitalId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
