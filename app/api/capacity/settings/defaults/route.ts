// app/api/capacity/settings/defaults/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { resolveHidStrict } from "@/lib/tenant/resolve-hid";

type Settings = {
  specials: string[];
  defaults: { BASIC: number; NHIS: number; SPECIAL: number };
  examDefaults: Record<string, number>;
};

// 새 행 보장. 기본치는 CapacityDefault에서만 읽음. 없으면 0.
async function ensureRow(hospitalId: string) {
  const row = await prisma.capacitySetting.findUnique({ where: { hospitalId } });
  if (row) return row;

  const cd = await prisma.capacityDefault.findUnique({ where: { hospitalId } });
  const defaults = {
    BASIC: Number(cd?.basicCap ?? 0),
    NHIS: Number(cd?.nhisCap ?? 0),
    SPECIAL: Number(cd?.specialCap ?? 0),
  };

  return prisma.capacitySetting.create({
    data: {
      hospitalId,
      defaults: defaults as any,
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
  const labels = (row.specials as any)?.labels as string[] | undefined;
  const items = (row.specials as any)?.items as { id: string; name: string }[] | undefined;

  const res: Settings = {
    specials: labels ?? (items?.map((x) => x.name) ?? []),
    defaults: (row.defaults as any) ?? { BASIC: 0, NHIS: 0, SPECIAL: 0 },
    examDefaults: (row.examDefaults as any) ?? {},
  };
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const hid = await resolveHidStrict(req).catch(() => null);
  if (!hid) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const row = await ensureRow(hid);

  const nextDefaults = { ...(row.defaults as any) };
  if (body?.defaults) {
    const BASIC = Number(body.defaults.BASIC);
    const NHIS = Number(body.defaults.NHIS);
    const SPECIAL = Number(body.defaults.SPECIAL);
    if ([BASIC, NHIS, SPECIAL].every((n) => Number.isFinite(n) && n >= 0)) {
      nextDefaults.BASIC = BASIC;
      nextDefaults.NHIS = NHIS;
      nextDefaults.SPECIAL = SPECIAL;
    }
  }

  const nextExam = { ...(row.examDefaults as any) };
  if (body?.examDefaults && typeof body.examDefaults === "object") {
    for (const [k, v] of Object.entries(body.examDefaults)) {
      const n = Number(v as any);
      if (Number.isFinite(n) && n >= 0) nextExam[String(k)] = n;
    }
  }

  const nextSpecials = { ...(row.specials as any) };
  if (Array.isArray(body?.specials)) {
    nextSpecials.labels = body.specials.map((x: any) => String(x)).filter(Boolean);
  }

  const updated = await prisma.capacitySetting.update({
    where: { hospitalId: hid },
    data: { defaults: nextDefaults as any, examDefaults: nextExam as any, specials: nextSpecials as any },
  });

  const labels = (updated.specials as any)?.labels as string[] | undefined;
  const items = (updated.specials as any)?.items as { id: string; name: string }[] | undefined;

  const res: Settings = {
    specials: labels ?? (items?.map((x) => x.name) ?? []),
    defaults: (updated.defaults as any) ?? { BASIC: 0, NHIS: 0, SPECIAL: 0 },
    examDefaults: (updated.examDefaults as any) ?? {},
  };
  return NextResponse.json(res);
}


