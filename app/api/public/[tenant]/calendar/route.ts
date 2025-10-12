// app/api/public/[tenant]/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** DB의 dow와 JS getDay() 매칭 (DB: 0~6 또는 1~7 모두 허용) */
function dowMatches(dbDow: number, jsDow: number) {
  // JS: 0=Sun..6=Sat
  // 허용: db=js OR db=(js==0?7:js)  ← 월=1..일=7 저장 스키마 호환
  if (dbDow === jsDow) return true;
  if (dbDow === (jsDow === 0 ? 7 : jsDow)) return true;
  return false;
}

export async function GET(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    const url = new URL(req.url);
    const month = (url.searchParams.get("month") || "").trim(); // YYYY-MM
    const section = (url.searchParams.get("section") || "").trim().toUpperCase(); // (옵션) GENERAL/NHIS/SPECIAL...
    const disableSunday = url.searchParams.get("disableSunday") === "1";

    const hospital = await prisma.hospital.findUnique({
      where: { slug: params.tenant },
      select: { id: true },
    });
    if (!hospital) return NextResponse.json({ ok: false, error: "INVALID_TENANT" }, { status: 404 });

    const base = month && /^\d{4}-\d{2}$/.test(month)
      ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
      : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const monthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

    // 주간 템플릿 조회 (섹션 컬럼이 없을 수도 있어 any로 where 구성)
    const whereTpl: any = { hospitalId: hospital.id };
    if (section) whereTpl.section = section;

    const templates = await prisma.slotTemplate.findMany({
      where: whereTpl,
      select: { dow: true, start: true, end: true, capacity: true, /* section: true */ },
      orderBy: [{ start: "asc" }],
    });

    // 해당 월 예약 집계 (취소/노쇼 제외 필요 시 where에 status 조건 추가)
    const bookings = await prisma.booking.findMany({
      where: {
        hospitalId: hospital.id,
        date: { gte: start as any, lt: end as any },
      },
      select: { date: true, time: true },
    });

    // key: YYYY-MM-DD|HH:mm → count
    const bookedMap = new Map<string, number>();
    for (const b of bookings) {
      const dObj = b.date as unknown as Date;
      const dStr = ymd(new Date(dObj));
      const key = `${dStr}|${b.time || ""}`;
      bookedMap.set(key, (bookedMap.get(key) || 0) + 1);
    }

    const days = [];
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const dateStr = ymd(d);
      const jsDow = d.getDay(); // 0~6 (Sun~Sat)

      // 템플릿(요일 매칭)
      const tpls = templates.filter(t => dowMatches(Number(t.dow || 0), jsDow));

      const reasons: string[] = [];
      if (disableSunday && jsDow === 0) reasons.push("일요일 휴무");
      if (tpls.length === 0) reasons.push("운영 템플릿 없음");

      let slots: { time: string; capacity: number; booked: number; remaining: number }[] = [];

      if (tpls.length > 0) {
        slots = tpls.map(t => {
          const time = t.start; // start를 슬롯 키로 사용
          const cap = Number(t.capacity || 0);
          const booked = bookedMap.get(`${dateStr}|${time}`) || 0;
          const remaining = Math.max(0, cap - booked);
          return { time, capacity: cap, booked, remaining };
        }).sort((a, b) => a.time.localeCompare(b.time));
      }

      const totalRemaining = slots.reduce((a, s) => a + s.remaining, 0);
      if (tpls.length > 0 && totalRemaining === 0) reasons.push("모든 시간대 정원 마감");

      const blocked = reasons.length > 0;
      const status: "OPEN" | "SOLD_OUT" | "CLOSED" = blocked
        ? (tpls.length === 0 ? "CLOSED" : "SOLD_OUT")
        : "OPEN";

      days.push({
        date: dateStr,
        weekday: jsDow,
        status,
        slots,
        totalRemaining,
        reasons,
      });
    }

    return NextResponse.json({ month: monthStr, days });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


