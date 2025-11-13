// app/api/capacity/settings/managed/route.ts  ← 새로 추가
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { resolveHidStrict } from "@/lib/tenant/resolve-hid";

type Managed = {
  manageBasic: boolean;
  manageEgd: boolean;
  manageCol: boolean;
  exams: string[];
};

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
  const managed = (row.managed as any) ?? { manageBasic: false, manageEgd: false, manageCol: false, exams: [] };
  return NextResponse.json(managed, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const hid = await resolveHidStrict(req).catch(() => null);
  if (!hid) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Partial<Managed>;
  const row = await ensureRow(hid);

  const cur = (row.managed as any) ?? {};
  const b = (x: any) => (typeof x === "boolean" ? x : false);
  const arr = Array.isArray(body.exams) ? Array.from(new Set(body.exams.map((s) => String(s).trim()).filter(Boolean))) : cur.exams ?? [];

  const managed: Managed = {
    manageBasic: b(body.manageBasic ?? cur.manageBasic),
    manageEgd: b(body.manageEgd ?? cur.manageEgd),
    manageCol: b(body.manageCol ?? cur.manageCol),
    exams: arr,
  };

  await prisma.capacitySetting.update({ where: { hospitalId: hid }, data: { managed: managed as any } });
  return NextResponse.json(managed, { headers: { "Cache-Control": "no-store" } });
}



