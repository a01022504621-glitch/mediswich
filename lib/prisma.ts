// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { getTenant } from "@/lib/tenant/als";

// 병원별 스코프를 적용할 모델 목록 (hospitalId 컬럼이 있는 모델들)
const SCOPED_MODELS = new Set([
  "User",
  "HospitalDomain",
  "Company",
  "Package",
  "SlotTemplate",
  "SlotException",
  "CapacityOverride",
  "CapacityDefault",
  "Booking",
  "AuditLog",
  "Client",
  "AddonItem",
  "AddonItemClient",
  "HospitalSubscription",
  "Invoice",
  "PackageSet",
]);

function isScoped(model: string) {
  return SCOPED_MODELS.has(model);
}

function withHospitalWhere(where: any, hospitalId: string) {
  if (!hospitalId) return where;
  return where ? { AND: [{ hospitalId }, where] } : { hospitalId };
}

function injectHospitalIdToData(data: any, hospitalId: string) {
  if (!hospitalId) return data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (data.hospitalId == null) data.hospitalId = hospitalId;
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((d) => (d && d.hospitalId == null ? { ...d, hospitalId } : d));
  }
  return data;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const base = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

export const prisma =
  globalForPrisma.prisma ??
  base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.where = withHospitalWhere(a.where, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.where = withHospitalWhere(a.where, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.where = withHospitalWhere(a.where, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.where = withHospitalWhere(a.where, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.where = withHospitalWhere(a.where, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.data = injectHospitalIdToData(a.data, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.data = injectHospitalIdToData(a.data, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.where = withHospitalWhere(a.where, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (isScoped(model)) {
            const ctx = getTenant();
            if (ctx?.hospitalId) {
              const a: any = args ?? {};
              a.where = withHospitalWhere(a.where, ctx.hospitalId);
              return query(a);
            }
          }
          return query(args);
        },

        async findUnique({ model, args, query }) {
          if (process.env.NODE_ENV === "development" && isScoped(model)) {
            console.warn(
              `[MSW-TENANT] ${model}.findUnique 사용시 병원 격리를 보장하려면 findFirst + where.hospitalId 사용을 권장합니다.`,
            );
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (process.env.NODE_ENV === "development" && isScoped(model)) {
            console.warn(
              `[MSW-TENANT] ${model}.update 사용시 병원 격리를 보장하려면 updateMany + where.hospitalId 사용을 권장합니다.`,
            );
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (process.env.NODE_ENV === "development" && isScoped(model)) {
            console.warn(
              `[MSW-TENANT] ${model}.delete 사용시 병원 격리를 보장하려면 deleteMany + where.hospitalId 사용을 권장합니다.`,
            );
          }
          return query(args);
        },
      },
    },
  });

if (process.env.NODE_ENV !== "production") (globalForPrisma.prisma as any) = prisma;

