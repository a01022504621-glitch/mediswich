// app/api/capacity/specials/route.ts  (외부 공개 GET 전용)
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
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } },
  );
}



