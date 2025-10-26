// lib/prisma-scope.ts
import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

type Scope = { hospitalId?: string };

const g = globalThis as unknown as { __prisma?: PrismaClient };
const prisma =
  g.__prisma ??
  new PrismaClient({
    // log: ["warn", "error"],
  });
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

const scope = new AsyncLocalStorage<Scope>();
export function runAs<T>(hospitalId: string, fn: () => Promise<T>) {
  return scope.run({ hospitalId }, fn);
}
export default prisma;

const SCOPED = new Set<string>([
  "Booking",
  "Package",
  "Company",
  "Client",
  "SlotTemplate",
  "SlotException",
  "CapacityOverride",
  "CapacityDefault",
  "AddonItem",
  "AddonItemClient",
  "AuditLog",
  "HospitalDomain",
  "Invoice",
  "HospitalSubscription",
]);

// Edge 런타임 보호: $use가 있을 때만 미들웨어 주입
const use = (prisma as any).$use;
if (typeof use === "function") {
  (prisma as any).$use(async (params: any, next: (p: any) => Promise<any>) => {
    const ctx = scope.getStore();
    if (!ctx?.hospitalId || !params.model || !SCOPED.has(params.model)) {
      return next(params);
    }

    switch (params.action) {
      case "findUnique":
      case "findUniqueOrThrow":
      case "findFirst":
      case "findFirstOrThrow":
      case "findMany":
      case "count":
      case "aggregate":
      case "groupBy":
      case "update":
      case "updateMany":
      case "delete":
      case "deleteMany":
        params.args ||= {};
        params.args.where = { ...(params.args?.where ?? {}), hospitalId: ctx.hospitalId };
        break;
      case "create":
        params.args ||= {};
        params.args.data = { ...(params.args?.data ?? {}), hospitalId: ctx.hospitalId };
        break;
      case "createMany":
        params.args ||= {};
        const arr = Array.isArray(params.args.data) ? params.args.data : [params.args.data];
        params.args.data = arr.map((d: any) => ({ ...(d ?? {}), hospitalId: ctx.hospitalId }));
        break;
      case "upsert":
        params.args ||= {};
        params.args.where = { ...(params.args?.where ?? {}), hospitalId: ctx.hospitalId };
        params.args.create = { ...(params.args?.create ?? {}), hospitalId: ctx.hospitalId };
        params.args.update = { ...(params.args?.update ?? {}), hospitalId: ctx.hospitalId };
        break;
    }
    return next(params);
  });
}



