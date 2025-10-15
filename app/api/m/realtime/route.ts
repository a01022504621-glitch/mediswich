// 경로: mediswich/app/api/m/realtime/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { mapBookingToRow, type DBBooking } from "@/lib/realtime/mapBookingToRow";

/** UTC 기준 YYYY-MM-DD */
const toYMDUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const year = Number(sp.get("year") || new Date().getUTCFullYear());
    const from = sp.get("from");
    const to = sp.get("to");

    const org = await requireOrg();
    const hospitalId = org.id;

    // 기간 계산: [fromDate, toDate)
    const fromDate = from ? new Date(from) : new Date(Date.UTC(year, 0, 1));
    const rawTo = to ? new Date(to) : new Date(Date.UTC(year + 1, 0, 1));
    const toDate = to
      ? new Date(Date.UTC(rawTo.getUTCFullYear(), rawTo.getUTCMonth(), rawTo.getUTCDate() + 1))
      : rawTo;

    const rows = await prisma.booking.findMany({
      where: { hospitalId, date: { gte: fromDate, lt: toDate } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        patientBirth: true,
        date: true,
        time: true,
        status: true,
        createdAt: true,
        meta: true,
        package: { select: { title: true } },
      },
    });

    // 타입 캐스팅 후 공용 매퍼 사용
    const items = (rows as unknown as DBBooking[]).map(mapBookingToRow);

    // 헤더의 요약용 totalAll 참고를 위해 총합 같이 리턴
    return NextResponse.json({ items, total: items.length, range: { from: toYMDUTC(fromDate), to: toYMDUTC(new Date(toDate.getTime() - 86400000)) } });
  } catch (e: any) {
    console.error("API Error in /api/m/realtime:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}




