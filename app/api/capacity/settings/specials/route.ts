// app/api/capacity/settings/specials/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { resolveHidStrict } from "@/lib/tenant/resolve-hid";

type Special = { id: string; name: string };

async function ensureRow(hospitalId: string) {
  const row = await prisma.capacitySetting.findUnique({ where: { hospitalId } });
  if (row) return row;
  return prisma.capacitySetting.create({
    data: {
      hospitalId,
      defaults: { BASIC: 0, NHIS: 0, SPECIAL: 0 } as any,
      examDefaults: {} as any,
      specials: { items: [], labels: [] } as any,
      managed: { manageBasic: false, manageEgd: false, manageCol: false, exams: [] } as any,
    },
  });
}

export async function GET(req: NextRequest) {
  const hid = await resolveHidStrict(req).catch(() => null);
  if (!hid) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 400 });

  const row = await ensureRow(hid);
  const items = ((row.specials as any)?.items as Special[] | undefined) ?? [];
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT body
 *  - { set: Special[] }        // 전체 교체
 *  - { add: Special }          // 1건 추가
 *  - { removeIds: string[] }   // 여러 건 삭제
 */
export async function PUT(req: NextRequest) {
  const hid = await resolveHidStrict(req).catch(() => null);
  if (!hid) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const row = await ensureRow(hid);
  const cur = ((row.specials as any)?.items as Special[] | undefined) ?? [];

  const norm = (x: any): Special | null =>
    x && typeof x.id === "string" && typeof x.name === "string"
      ? { id: x.id.trim(), name: x.name.trim() }
      : null;

  let next: Special[] = cur;
  if (Array.isArray(body.set)) {
    next = (body.set.map(norm).filter(Boolean) as Special[]).slice(0, 200);
  } else if (body.add) {
    const v = norm(body.add);
    if (v && !cur.some((s) => s.id === v.id)) next = [...cur, v];
  } else if (Array.isArray(body.removeIds)) {
    const del = new Set(body.removeIds.map(String));
    next = cur.filter((s) => !del.has(s.id));
  }

  const updated = await prisma.capacitySetting.update({
    where: { hospitalId: hid },
    data: { specials: { items: next, labels: (row.specials as any)?.labels ?? [] } as any },
  });

  return NextResponse.json({ items: ((updated.specials as any)?.items as Special[]) ?? [] });
}



