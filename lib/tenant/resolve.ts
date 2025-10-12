// lib/tenant/resolve.ts
import { prisma } from "@/lib/prisma";

/** 요청 인자 */
export type Input = {
  slug?: string | null;
  slugOrTenant?: string | null;
  host?: string | null | undefined;
};

/** 레이아웃·쿠키에 쓰는 표준 DTO */
export type TenantPublic = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
};

// 오버로드: 문자열(slug) 또는 객체 입력 모두 허용
export async function resolveTenantHybrid(input: Input): Promise<TenantPublic | null>;
export async function resolveTenantHybrid(slug: string): Promise<TenantPublic | null>;
export async function resolveTenantHybrid(input: Input | string): Promise<TenantPublic | null> {
  const slug = (typeof input === "string"
    ? input
    : input.slug ?? input.slugOrTenant ?? ""
  ).trim().toLowerCase();

  const rawHost = (typeof input === "string" ? "" : input.host ?? "").toLowerCase();
  const hostNoPort = rawHost.split(":")[0]; // localhost:3000 -> localhost
  const isLocal = hostNoPort === "localhost" || hostNoPort === "127.0.0.1";

  // 1) slug 우선
  if (slug) {
    const h = await prisma.hospital.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, domain: true },
    });
    if (h) return { id: h.id, slug: h.slug, name: h.name, domain: h.domain ?? null };
  }

  // 2) host fallback(로컬 호스트는 무시)
  if (!isLocal && hostNoPort) {
    const h = await prisma.hospital.findFirst({
      where: {
        OR: [
          { domain: hostNoPort },                          // Hospital.domain
          { domains: { some: { host: hostNoPort } } },     // HospitalDomain.host
        ],
      },
      select: { id: true, slug: true, name: true, domain: true },
    });
    if (h) return { id: h.id, slug: h.slug, name: h.name, domain: h.domain ?? null };
  }

  return null;
}


