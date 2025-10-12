// /lib/db.ts
import { PrismaClient } from "@prisma/client";

/**
 * Next.js dev 모드에서 hot-reload 시 PrismaClient가 중복 생성되는 걸 방지.
 * prod 에서는 항상 새 인스턴스 사용.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    // 필요 시 쿼리 로그
    // log: ["query", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
