// app/api/capacity/exam-managed/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { resolveHidStrict } from "@/lib/tenant/resolve-hid";

type ManagedShape = { manageBasic: boolean; manageEgd: boolean; manageCol: boolean; exams: string[] };

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
  const m = ((row.managed as any) ?? {}) as ManagedShape;

  return NextResponse.json(
    {
      basic: !!m.manageBasic,
      nhis: false,
      special: !!(m.manageCol || m.manageEgd),
      exams: Array.isArray(m.exams) ? m.exams : [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** PUT body: { basic?, egd?, col?, set?: string[], add?: string[], remove?: string[] } */
export async function PUT(req: NextRequest) {
  const hid = await resolveHidStrict(req).catch(() => null);
  if (!hid) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 400 });

  const row = await ensureRow(hid);
  const body = await req.json().catch(() => ({} as any));
  const cur = ((row.managed as any) ?? { manageBasic: false, manageEgd: false, manageCol: false, exams: [] }) as ManagedShape;

  if (typeof body.basic === "boolean") cur.manageBasic = body.basic;
  if (typeof body.egd === "boolean") cur.manageEgd = body.egd;
  if (typeof body.col === "boolean") cur.manageCol = body.col;

  let nextExams = Array.isArray(cur.exams) ? [...cur.exams.map(String)] : [];
  if (Array.isArray(body.set)) {
    nextExams = body.set.map(String);
  } else {
    if (Array.isArray(body.add)) for (const id of body.add) nextExams.push(String(id));
    if (Array.isArray(body.remove)) {
      const del = new Set(body.remove.map(String));
      nextExams = nextExams.filter((x) => !del.has(x));
    }
    nextExams = Array.from(new Set(nextExams));
  }

  const updated = await prisma.capacitySetting.update({
    where: { hospitalId: hid },
    data: { managed: { manageBasic: cur.manageBasic, manageEgd: cur.manageEgd, manageCol: cur.manageCol, exams: nextExams } as any },
  });

  const m = (updated.managed as any) as ManagedShape;
  return NextResponse.json({
    basic: !!m.manageBasic,
    nhis: false,
    special: !!(m.manageCol || m.manageEgd),
    exams: Array.isArray(m.exams) ? m.exams : [],
  });
}

