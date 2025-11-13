// app/api/capacity/settings/exam-defaults/route.ts  ← 새로 추가
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { resolveHidStrict } from "@/lib/tenant/resolve-hid";

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
  return NextResponse.json((row.examDefaults as any) ?? {}, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const hid = await resolveHidStrict(req).catch(() => null);
  if (!hid) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 400 });

  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const row = await ensureRow(hid);

  const next: Record<string, number> = { ...(row.examDefaults as any) };
  if (patch && typeof patch === "object") {
    for (const [k, v] of Object.entries(patch)) {
      const n = Number(v as any);
      if (Number.isFinite(n) && n >= 0) next[String(k)] = n;
    }
  }

  const updated = await prisma.capacitySetting.update({
    where: { hospitalId: hid },
    data: { examDefaults: next as any },
  });
  return NextResponse.json((updated.examDefaults as any) ?? {}, { headers: { "Cache-Control": "no-store" } });
}




