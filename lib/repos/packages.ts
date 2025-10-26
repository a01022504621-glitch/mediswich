// lib/repos/packages.ts
import prisma from "@/lib/prisma-scope";
import type { Package, PackageCategory } from "@prisma/client";

/** 병원 식별: slug 우선 → 도메인(host) → 유일 병원 fallback */
export async function resolveHospitalId(opts: { slug?: string; host?: string }) {
  const { slug, host } = opts;

  if (slug) {
    const h = await prisma.hospital.findUnique({ where: { slug } });
    if (h) return h.id;
  }

  if (host) {
    const map = await prisma.hospitalDomain.findUnique({ where: { host } });
    if (map) return map.hospitalId;
  }

  const cnt = await prisma.hospital.count();
  if (cnt === 1) {
    const only = await prisma.hospital.findFirst();
    if (only) return only.id;
  }

  throw new Error("HOSPITAL_RESOLVE_FAILED");
}

/** 카테고리별 노출 패키지 목록 */
export async function listVisibleByCategories(hospitalId: string, cats: PackageCategory[]) {
  const result: Record<string, Package[]> = {};
  await Promise.all(
    cats.map(async (cat) => {
      const rows = await prisma.package.findMany({
        where: { hospitalId, visible: true, category: cat },
        orderBy: { createdAt: "desc" },
      });
      result[cat] = rows;
    })
  );
  return result as Record<PackageCategory, Package[]>;
}

/** 한 병원의 모든 노출 패키지 */
export async function listAllVisible(hospitalId: string) {
  return prisma.package.findMany({
    where: { hospitalId, visible: true },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
}

/** 기업코드 검증: Client.code 사용(대소문자/공백 너그럽게 처리, 기간 유효성) */
export async function validateCorporateCode(hospitalId: string, rawCode: string) {
  const now = new Date();
  const raw = (rawCode || "").trim();
  if (!raw) return null;

  // 공백 제거/대문자 변형 후보들
  const candidates = Array.from(
    new Set([raw, raw.toUpperCase(), raw.replace(/\s+/g, ""), raw.replace(/\s+/g, "").toUpperCase()])
  );

  const hit = await prisma.client.findFirst({
    where: {
      hospitalId,
      code: { in: candidates },
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
  });

  return hit; // 없으면 null
}

/** 제목 기준 업서트(관리자 빌더→DB 동기화용) */
export async function upsertPackageByTitle(hospitalId: string, input: {
  title: string;
  summary?: string | null;
  price?: number | null;
  visible?: boolean;
  category: PackageCategory;
  tags?: any; // 자유 JSON
}) {
  const existing = await prisma.package.findFirst({
    where: { hospitalId, title: input.title },
  });

  const data = {
    hospitalId,
    title: input.title,
    summary: input.summary ?? null,
    price: input.price ?? null,
    visible: input.visible ?? true,
    category: input.category,
    // Prisma: Json은 undefined일 때 미변경, null 허용X
    ...(typeof input.tags !== "undefined" ? { tags: input.tags as any } : {}),
  };

  if (existing) {
    return prisma.package.update({ where: { id: existing.id }, data });
  }
  return prisma.package.create({ data });
}

