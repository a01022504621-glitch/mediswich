// app/api/m/dashboard/v2/summary/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { pickBasisDate } from "@/lib/services/booking-effective-date";

type YMD = `${number}-${number}-${number}`;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date): YMD => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` as YMD;
const kst0 = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n*86400000);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const span = Math.max(1, Math.min(90, Number(url.searchParams.get("span") ?? 7))); // 7|14|30 권장
    const to = url.searchParams.get("to") || toYMD(new Date());
    const from = toYMD(addDays(kst0(to), -(span - 1)));

    const s = await requireSession();
    const hospitalId = (s as any).hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok:false, error:"NO_HOSPITAL" }, { status:401 });

    const fromK = kst0(from);
    const toK   = addDays(kst0(to), 1);

    // 넓게 조회 후 애플리케이션에서 기준일 계산(신청/확정/완료)
    const bookings = await runAs(hospitalId, () =>
      prisma.booking.findMany({
        where: {
          hospitalId,
          OR: [
            { createdAt: { gte: fromK, lt: toK } },
            { date:       { gte: fromK, lt: toK } },
            { effectiveDate: { gte: fromK, lt: toK } },
          ],
        },
        select: { createdAt:true, date:true, meta:true }
      })
    );

    // 변경 이력(예약변경은 로그 시각 기준)
    const changes = await runAs(hospitalId, () =>
      prisma.bookingChangeLog.findMany({
        where: { booking: { hospitalId }, createdAt: { gte: fromK, lt: toK } },
        select: { createdAt:true }
      })
    );

    const todayY = toYMD(new Date());
    const isToday = (d: Date|null) => d && toYMD(d) === todayY;

    // 오늘 카드
    let todayRequested=0, todayConfirmed=0, todayCompleted=0, todayChanged=0;
    for (const b of bookings) {
      if (isToday(b.createdAt)) todayRequested++;
      if (isToday(pickBasisDate(b, "confirmed"))) todayConfirmed++;
      if (isToday(pickBasisDate(b, "completed"))) todayCompleted++;
    }
    todayChanged = changes.filter(x => isToday(x.createdAt as any)).length;

    // 기간 합계 카드
    let spanRequested=0, spanConfirmed=0, spanCompleted=0, spanChanged=0;
    for (const b of bookings) {
      const req = b.createdAt;
      const con = pickBasisDate(b, "confirmed");
      const com = pickBasisDate(b, "completed");
      if (req && +req >= +fromK && +req < +toK) spanRequested++;
      if (con && +con >= +fromK && +con < +toK) spanConfirmed++;
      if (com && +com >= +fromK && +com < +toK) spanCompleted++;
    }
    spanChanged = changes.length;

    return NextResponse.json({
      ok: true,
      today: { requested: todayRequested, confirmed: todayConfirmed, changed: todayChanged, completed: todayCompleted },
      span:  { days: span, requested: spanRequested, confirmed: spanConfirmed, changed: spanChanged, completed: spanCompleted },
      range: { from, to }
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ ok:false, error:e?.message || "INTERNAL" }, { status:500 });
  }
}

