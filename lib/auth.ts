// lib/auth.ts
import { cookies } from "next/headers";
import prisma from "@/lib/prisma-scope";

// 정석 진입점: guard 재노출
export {
  optionalSession,
  requireSession,
  requireRole,
  assertRole,
} from "@/lib/auth/guard";

// 하위호환: 과거 requireUser 사용처 방지
export { requireSession as requireUser } from "@/lib/auth/guard";

/**
 * 병원(조직) 컨텍스트.
 * 우선순위:
 *  1) 쿠키 hospitalId (문자열 ID)
 *  2) 쿠키 hospitalSlug / orgSlug (문자)
 *  3) DB 첫 병원 (개발 편의 fallback)
 */
export async function requireOrg() {
  const ck = cookies();
  const idStr = ck.get("hospitalId")?.value?.trim();
  const slugStr =
    ck.get("hospitalSlug")?.value ||
    ck.get("orgSlug")?.value ||
    undefined;
  const slug = slugStr?.trim();

  let org = null as Awaited<ReturnType<typeof prisma.hospital.findFirst>> | null;

  // 1) ID 우선
  if (idStr) {
    org = await prisma.hospital.findUnique({ where: { id: idStr } });
  }

  // 2) slug fallback
  if (!org && slug) {
    org = await prisma.hospital.findUnique({ where: { slug } });
  }

  // 3) 개발 편의 fallback
  if (!org) {
    org = await prisma.hospital.findFirst({ orderBy: { id: "asc" } });
  }

  if (!org) throw new Error("HOSPITAL_NOT_FOUND");
  return org;
}

