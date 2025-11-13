// app/api/m/dashboard/summary/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { pickBasisDate, type Basis } from "@/lib/services/booking-effective-date";

const kst0 = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const toYMD = (d: Date) => `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || toYMD(new Date());
    const to = url.searchParams.get("to") || from;
    const basis = (url.searchParams.get("basis") as Basis) || "requested";

    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "NO_HOSPITAL" }, { status: 401 });

    const fromK = kst0(from);
    const toK = addDays(kst0(to), 1);

    const rows = await runAs(hospitalId, () =>
      prisma.booking.findMany({
        where: {
          hospitalId,
          OR: [
            { createdAt: { gte: fromK, lt: toK } },
            { date: { gte: fromK, lt: toK } },
            { effectiveDate: { gte: fromK, lt: toK } },
          ],
        },
        select: { status: true, createdAt: true, date: true, meta: true },
      }),
    );

    const todayY = toYMD(new Date());
    let todayUsed = 0, new7 = 0, prog7 = 0, cancel7 = 0;

    for (const b of rows) {
      const dBasis = pickBasisDate(b, basis);
      if (!dBasis) continue;
      const inRange = +dBasis >= +fromK && +dBasis < +toK;
      if (!inRange) continue;

      if (toYMD(dBasis) === todayY) {
        // 오늘 사용: 진행/확정/완료
        if (b.status === "RESERVED" || b.status === "CONFIRMED" || b.status === "COMPLETED" || b.status === "AMENDED") {
          todayUsed += 1;
        }
      }
      if (b.status === "PENDING") new7 += 1;
      if (b.status === "RESERVED" || b.status === "AMENDED") prog7 += 1;
      if (b.status === "CANCELED" || b.status === "NO_SHOW") cancel7 += 1;
    }

    return NextResponse.json({
      ok: true,
      cards: {
        todayUsed,
        new7,
        progress7: prog7,
        canceled7: cancel7,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}





