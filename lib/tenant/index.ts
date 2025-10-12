// /lib/tenant/index.ts
import "server-only";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export type TenantCtx = { hid: string; slug?: string | null };

export async function getCtx(): Promise<TenantCtx> {
  const s = await requireSession();

  if (s.hospitalId) {
    return { hid: s.hospitalId, slug: s.hospitalSlug ?? null };
  }

  if (s.hospitalSlug) {
    const h = await prisma.hospital.findFirst({
      where: { OR: [{ slug: s.hospitalSlug }, { id: s.hospitalSlug }] },
      select: { id: true, slug: true },
    });
    if (h) return { hid: h.id, slug: h.slug ?? null };
  }

  if (s.sub) {
    const u = await prisma.user.findUnique({
      where: { id: s.sub },
      select: { hospitalId: true, hospital: { select: { slug: true } } },
    });
    if (u?.hospitalId) return { hid: u.hospitalId, slug: u.hospital?.slug ?? null };
  }

  throw new Error("No tenant in session");
}

