// app/api/m/dashboard/kpis/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { startOfDay, endOfDay, addDays, formatYMD } from "@/lib/metrics/date";
import { computeDailyCapacity } from "@/lib/metrics/capacity";

const ACTIVE: Array<"PENDING" | "RESERVED" | "CONFIRMED"> = ["PENDING", "RESERVED", "CONFIRMED"];

export async function GET(_req: NextRequest) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 401 });

    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    // 오늘 cap/used/closed
    const todayCap = await computeDailyCapacity(hospitalId, today);
    const usedToday = await runAs(hospitalId, () =>
      prisma.booking.count({
        where: { hospitalId, effectiveDate: { gte: today, lt: tomorrow }, status: { in: ACTIVE as any } },
      }),
    );

    // 7일 집계
    const from7 = addDays(today, -6);
    const to7 = addDays(today, 1);

    const [total7, canceled7, amended7, created7] = await runAs(hospitalId, () =>
      Promise.all([
        prisma.booking.count({
          where: { hospitalId, effectiveDate: { gte: from7, lt: to7 }, status: { in: ACTIVE as any } },
        }),
        prisma.booking.count({
          where: { hospitalId, effectiveDate: { gte: from7, lt: to7 }, status: "CANCELED" as any },
        }),
        prisma.booking.count({
          where: { hospitalId, effectiveDate: { gte: from7, lt: to7 }, status: "AMENDED" as any },
        }),
        prisma.booking.count({
          where: { hospitalId, createdAt: { gte: from7, lt: to7 } },
        }),
      ]),
    );

    // 7일 가동률(분모=cap 합, 분자=used 합)
    let capSum7 = 0;
    let usedSum7 = 0;
    for (let d = new Date(from7); d < to7; d = addDays(d, 1)) {
      const cap = await computeDailyCapacity(hospitalId, d);
      capSum7 += cap.cap;
      const u = await runAs(hospitalId, () =>
        prisma.booking.count({
          where: { hospitalId, effectiveDate: { gte: startOfDay(d), lt: addDays(startOfDay(d), 1) }, status: { in: ACTIVE as any } },
        }),
      );
      usedSum7 += u;
    }

    const res = {
      ok: true,
      today: {
        date: formatYMD(today),
        used: usedToday,
        cap: todayCap.cap,
        utilization: todayCap.cap > 0 ? usedToday / todayCap.cap : 0,
        closed: todayCap.closed,
      },
      last7d: {
        from: formatYMD(from7),
        to: formatYMD(addDays(to7, -1)),
        created: created7,
        active: total7,
        canceled: canceled7,
        amended: amended7,
        utilization: capSum7 > 0 ? usedSum7 / capSum7 : 0,
      },
    };

    return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}


