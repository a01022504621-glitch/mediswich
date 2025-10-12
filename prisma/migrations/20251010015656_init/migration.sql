-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('MASTER_ADMIN', 'HOSPITAL_OWNER', 'HOSPITAL_STAFF');

-- CreateEnum
CREATE TYPE "public"."PackageCategory" AS ENUM ('NHIS', 'GENERAL', 'CORP');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'RESERVED', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "public"."Sex" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "public"."Hospital" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "themeJson" TEXT,
    "noticeHtml" TEXT,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HospitalDomain" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "hospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jwt" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Package" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "price" INTEGER,
    "tags" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "category" "public"."PackageCategory" NOT NULL DEFAULT 'GENERAL',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "baseCount" INTEGER,
    "selectCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SlotTemplate" (
    "id" TEXT NOT NULL,
    "dow" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "hospitalId" TEXT NOT NULL,

    CONSTRAINT "SlotTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SlotException" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "hospitalId" TEXT NOT NULL,

    CONSTRAINT "SlotException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CapacityOverride" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "planned" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CapacityDefault" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "basicCap" INTEGER,
    "nhisCap" INTEGER,
    "specialCap" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "companyId" TEXT,
    "packageId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT,
    "patientBirth" TEXT,
    "sex" "public"."Sex",
    "code" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'RESERVED',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "memo" TEXT,
    "code" TEXT,
    "directUrl" TEXT,
    "participantsCount" INTEGER NOT NULL DEFAULT 0,
    "participants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AddonItem" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sex" "public"."Sex",
    "priceKRW" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AddonItemClient" (
    "id" TEXT NOT NULL,
    "addonItemId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priceKRW" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddonItemClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceKRW" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HospitalSubscription" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "billingType" TEXT NOT NULL DEFAULT 'INVOICE',
    "pgCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountKRW" INTEGER NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "pgPaymentId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_slug_key" ON "public"."Hospital"("slug");

-- CreateIndex
CREATE INDEX "Hospital_slug_idx" ON "public"."Hospital"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalDomain_host_key" ON "public"."HospitalDomain"("host");

-- CreateIndex
CREATE INDEX "HospitalDomain_hospitalId_idx" ON "public"."HospitalDomain"("hospitalId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_hospitalId_email_key" ON "public"."User"("hospitalId", "email");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "public"."Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_token_key" ON "public"."Company"("token");

-- CreateIndex
CREATE INDEX "Company_hospitalId_idx" ON "public"."Company"("hospitalId");

-- CreateIndex
CREATE INDEX "Package_hospitalId_category_visible_clientId_idx" ON "public"."Package"("hospitalId", "category", "visible", "clientId");

-- CreateIndex
CREATE INDEX "Package_hospitalId_visible_startDate_endDate_idx" ON "public"."Package"("hospitalId", "visible", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "SlotTemplate_hospitalId_dow_idx" ON "public"."SlotTemplate"("hospitalId", "dow");

-- CreateIndex
CREATE INDEX "SlotException_hospitalId_date_idx" ON "public"."SlotException"("hospitalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SlotException_hospitalId_date_key" ON "public"."SlotException"("hospitalId", "date");

-- CreateIndex
CREATE INDEX "CapacityOverride_hospitalId_date_idx" ON "public"."CapacityOverride"("hospitalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityOverride_hospitalId_date_type_key" ON "public"."CapacityOverride"("hospitalId", "date", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityDefault_hospitalId_key" ON "public"."CapacityDefault"("hospitalId");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_date_idx" ON "public"."Booking"("hospitalId", "date");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_phoneNormalized_idx" ON "public"."Booking"("hospitalId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "Booking_hospitalId_date_time_idx" ON "public"."Booking"("hospitalId", "date", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_hospitalId_code_key" ON "public"."Booking"("hospitalId", "code");

-- CreateIndex
CREATE INDEX "AuditLog_hospitalId_idx" ON "public"."AuditLog"("hospitalId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Client_hospitalId_name_idx" ON "public"."Client"("hospitalId", "name");

-- CreateIndex
CREATE INDEX "Client_hospitalId_code_idx" ON "public"."Client"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Client_hospitalId_code_key" ON "public"."Client"("hospitalId", "code");

-- CreateIndex
CREATE INDEX "AddonItem_hospitalId_isActive_idx" ON "public"."AddonItem"("hospitalId", "isActive");

-- CreateIndex
CREATE INDEX "AddonItem_hospitalId_name_idx" ON "public"."AddonItem"("hospitalId", "name");

-- CreateIndex
CREATE INDEX "AddonItemClient_clientId_idx" ON "public"."AddonItemClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AddonItemClient_addonItemId_clientId_key" ON "public"."AddonItemClient"("addonItemId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "public"."Plan"("code");

-- CreateIndex
CREATE INDEX "HospitalSubscription_hospitalId_idx" ON "public"."HospitalSubscription"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalSubscription_status_idx" ON "public"."HospitalSubscription"("status");

-- CreateIndex
CREATE INDEX "HospitalSubscription_currentPeriodEnd_idx" ON "public"."HospitalSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Invoice_hospitalId_issuedAt_idx" ON "public"."Invoice"("hospitalId", "issuedAt");

-- AddForeignKey
ALTER TABLE "public"."HospitalDomain" ADD CONSTRAINT "HospitalDomain_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Package" ADD CONSTRAINT "Package_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Package" ADD CONSTRAINT "Package_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SlotTemplate" ADD CONSTRAINT "SlotTemplate_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SlotException" ADD CONSTRAINT "SlotException_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CapacityOverride" ADD CONSTRAINT "CapacityOverride_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CapacityDefault" ADD CONSTRAINT "CapacityDefault_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AddonItem" ADD CONSTRAINT "AddonItem_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AddonItemClient" ADD CONSTRAINT "AddonItemClient_addonItemId_fkey" FOREIGN KEY ("addonItemId") REFERENCES "public"."AddonItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AddonItemClient" ADD CONSTRAINT "AddonItemClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HospitalSubscription" ADD CONSTRAINT "HospitalSubscription_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HospitalSubscription" ADD CONSTRAINT "HospitalSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
