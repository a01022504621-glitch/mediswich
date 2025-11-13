// app/api/m/dashboard/funnel/route.ts  (선택 추가)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { parseYMD, startOfDay, addDays } from "@/lib/metrics/date";

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 401 });

    const url = new URL(req.url);
    const from = parseYMD(url.searchParams.get("from") || "") ?? startOfDay(addDays(new Date(), -29));
    const to = addDays(parseYMD(url.searchParams.get("to") || "") ?? startOfDay(new Date()), 1);

    const [requested, reserved, confirmed, completed, canceled] = await runAs(hospitalId, () =>
      Promise.all([
        prisma.booking.count({ where: { hospitalId, createdAt: { gte: from, lt: to } } }),
        prisma.booking.count({ where: { hospitalId, effectiveDate: { gte: from, lt: to }, status: "RESERVED" as any } }),
        prisma.booking.count({ where: { hospitalId, effectiveDate: { gte: from, lt: to }, status: "CONFIRMED" as any } }),
        prisma.booking.count({ where: { hospitalId, effectiveDate: { gte: from, lt: to }, status: "COMPLETED" as any } }),
        prisma.booking.count({ where: { hospitalId, effectiveDate: { gte: from, lt: to }, status: "CANCELED" as any } }),
      ]),
    );

    return NextResponse.json({ ok: true, data: { requested, reserved, confirmed, completed, canceled } }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}




