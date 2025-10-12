// app/api/public/[tenant]/timeslots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type YMD = `${number}-${number}-${number}`;
type HM = `${number}:${number}`;

const CC_PUBLIC = "public, s-maxage=60, stale-while-revalidate=600";

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

const parseISO = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
};

function halfHourRange(start: string, end: string): HM[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const out: HM[] = [];
  for (let m0 = startMin; m0 <= endMin; m0 += 30) {
    const h = Math.floor(m0 / 60);
    const m = m0 % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as HM);
  }
  return out;
}

// 관리자 휴무/마감 탐색
async function isClosedDay(hospitalId: string, dayStart: Date, nextStart: Date) {
  const p: any = prisma as any;
  const candidates = [
    ["slotException", { date: true }],
    ["capacityOverride", { date: true, isClosed: true }],
    ["calendarClose", { date: true }],
    ["holiday", { date: true, closed: true }],
    ["dayClose", { date: true }],
  ] as const;

  for (const [model, select] of candidates) {
    try {
      const repo = p?.[model];
      if (!repo?.findMany) continue;
      const rows = await repo.findMany({
        where: { hospitalId, date: { gte: dayStart, lt: nextStart } },
        select,
      });
      for (const r of rows || []) {
        if (typeof (r as any)?.isClosed === "boolean" && (r as any).isClosed === false) continue;
        return true;
      }
    } catch {}
  }
  return false;
}

export async function GET(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    const url = new URL(req.url);
    const dateStr = (url.searchParams.get("date") || "").trim(); // YYYY-MM-DD

    const date = parseISO(dateStr);
    if (!date) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400, headers: { "cache-control": "no-store" } });
    }

    const hosp = await prisma.hospital.findFirst({
      where: { slug: params.tenant },
      select: { id: true },
    });
    if (!hosp) {
      return NextResponse.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404, headers: { "cache-control": CC_PUBLIC } });
    }

    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const nextStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);

    // 요일 템플릿 로드
    const dow = dayStart.getDay();
    const templates = await prisma.slotTemplate.findMany({
      where: { hospitalId: hosp.id, dow },
      select: { start: true, end: true, capacity: true },
      orderBy: { start: "asc" },
    });

    if (!templates.length) {
      const body = { ok: true, date: toYMD(dayStart), closed: false, reasons: ["운영 일정이 없습니다"], slots: [] as any[] };
      const json = JSON.stringify(body);
      const etag = `"W/${createHash("sha1").update(json).digest("base64")}"`;
      const inm = req.headers.get("if-none-match");
      if (inm && inm === etag) return new NextResponse(null, { status: 304, headers: { "cache-control": CC_PUBLIC, etag } });
      return new NextResponse(json, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": CC_PUBLIC, etag } });
    }

    // 휴무/마감일 여부
    const closed = await isClosedDay(hosp.id, dayStart, nextStart);
    if (closed) {
      const body = { ok: true, date: toYMD(dayStart), closed: true, reasons: ["해당 일자는 휴무/마감 처리되었습니다"], slots: [] as any[] };
      const json = JSON.stringify(body);
      const etag = `"W/${createHash("sha1").update(json).digest("base64")}"`;
      const inm = req.headers.get("if-none-match");
      if (inm && inm === etag) return new NextResponse(null, { status: 304, headers: { "cache-control": CC_PUBLIC, etag } });
      return new NextResponse(json, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": CC_PUBLIC, etag } });
    }

    // 슬롯 테이블 구성: time -> cap
    const capByTime = new Map<HM, number>();
    for (const t of templates) {
      const times = halfHourRange(t.start, t.end);
      for (const hm of times) {
        const cur = capByTime.get(hm) ?? 0;
        capByTime.set(hm, Math.max(cur, Number(t.capacity) || 0));
      }
    }

    // 예약 사용량 (date+time 단위) — findMany 후 집계
    const rows = await prisma.booking.findMany({
      where: {
        hospitalId: hosp.id,
        date: { gte: dayStart, lt: nextStart },
        status: { in: ["PENDING", "RESERVED", "CONFIRMED"] as any },
      },
      select: { time: true },
    });

    const usedByTime = new Map<string, number>();
    for (const r of rows) usedByTime.set(r.time, (usedByTime.get(r.time) ?? 0) + 1);

    const slots = Array.from(capByTime.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([time, cap]) => {
        const used = usedByTime.get(time) || 0;
        const status = Math.max(0, (cap ?? 0) - used) > 0 ? "OPEN" : "FULL";
        return { time, cap, used, status } as const;
      });

    const body = { ok: true, date: toYMD(dayStart), closed: false, reasons: [] as string[], slots };
    const json = JSON.stringify(body);
    const etag = `"W/${createHash("sha1").update(json).digest("base64")}"`;
    const inm = req.headers.get("if-none-match");
    if (inm && inm === etag) return new NextResponse(null, { status: 304, headers: { "cache-control": CC_PUBLIC, etag } });

    return new NextResponse(json, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": CC_PUBLIC, etag },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

