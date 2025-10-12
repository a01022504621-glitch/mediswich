// app/api/public/[tenant]/capacity/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type YMD = `${number}-${number}-${number}`;
type ResKey = "basic" | "egd" | "col";

const CC_PUBLIC = "public, s-maxage=60, stale-while-revalidate=600";

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

const parseISO = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
};

// 리소스 키 정규화
function normResKey(s: string): ResKey | null {
  const k = s.trim().toLowerCase();
  if (k === "basic") return "basic";
  if (k === "egd" || k === "gast" || k === "upper" || k === "gastroscopy" || k === "upper-scope") return "egd";
  if (k === "col" || k === "cscope" || k === "colon" || k === "colonoscopy" || k === "c-scope") return "col";
  return null;
}

async function findClosedDates(hospitalId: string, fromStart: Date, toNextStart: Date) {
  const closed = new Set<YMD>();
  const p: any = prisma as any;
  const candidates = [
    ["slotException", { date: true }],
    ["capacityOverride", { date: true, isClosed: true, type: true }],
    ["calendarClose", { date: true }],
    ["holiday", { date: true, closed: true }],
    ["dayClose", { date: true }],
  ] as const;

  for (const [model, select] of candidates) {
    try {
      const repo = p?.[model];
      if (!repo?.findMany) continue;
      const rows = await repo.findMany({
        where: { hospitalId, date: { gte: fromStart, lt: toNextStart } },
        select,
      });
      for (const r of rows || []) {
        if (typeof (r as any)?.isClosed === "boolean" && (r as any).isClosed === false) continue;
        closed.add(toYMD((r as any).date));
      }
    } catch {}
  }
  return closed;
}

export async function GET(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    const url = new URL(req.url);
    const monthParam = (url.searchParams.get("month") || "").trim();
    const fromStr = (url.searchParams.get("from") || "").trim();
    const toStr = (url.searchParams.get("to") || "").trim();
    const resourcesParam = (url.searchParams.get("resources") || "").trim();

    const hosp = await prisma.hospital.findFirst({
      where: { slug: params.tenant },
      select: { id: true },
    });
    if (!hosp) {
      return NextResponse.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404, headers: { "cache-control": CC_PUBLIC } });
    }

    // (A) month=YYYY-MM → 달력 맵 모드
    if (monthParam && !fromStr && !toStr) {
      const y = Number(monthParam.slice(0, 4));
      const m = Number(monthParam.slice(5, 7)) - 1;
      if (!Number.isFinite(y) || !Number.isFinite(m)) {
        return NextResponse.json({ ok: false, error: "INVALID_MONTH" }, { status: 400, headers: { "cache-control": "no-store" } });
      }
      const fromStart = new Date(y, m, 1, 0, 0, 0, 0);
      const toNextStart = new Date(y, m + 1, 1, 0, 0, 0, 0);

      // 요일별 템플릿 → 일자 총 수용인원 합산
      const templates = await prisma.slotTemplate.findMany({
        where: { hospitalId: hosp.id },
        select: { dow: true, start: true, end: true, capacity: true },
        orderBy: { start: "asc" },
      });

      const slotsByDow: Record<number, { time: string; cap: number }[]> = {};
      for (const t of templates) {
        const [sh, sm] = t.start.split(":").map(Number);
        const [eh, em] = t.end.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const times: string[] = [];
        for (let m0 = startMin; m0 <= endMin; m0 += 30) {
          const h = Math.floor(m0 / 60);
          const mm = m0 % 60;
          times.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
        }
        slotsByDow[t.dow] = times.map((time) => ({ time, cap: t.capacity }));
      }

      const closedMap = await findClosedDates(hosp.id, fromStart, toNextStart);

      // 일별 예약 건수 합
      const activeStatuses = ["PENDING", "RESERVED", "CONFIRMED"] as const;
      const bookings = await prisma.booking.findMany({
        where: {
          hospitalId: hosp.id,
          date: { gte: fromStart, lt: toNextStart },
          status: { in: activeStatuses as any },
        },
        select: { date: true },
      });
      const usedByDay = new Map<YMD, number>();
      for (const b of bookings) {
        const key = toYMD(b.date);
        usedByDay.set(key, (usedByDay.get(key) || 0) + 1);
      }

      const result: Record<YMD, "OPEN" | "FULL" | "CLOSED"> = {};
      let cur = new Date(fromStart);
      while (cur < toNextStart) {
        const key = toYMD(cur);
        const temps = slotsByDow[cur.getDay()] || [];
        const sumCap = temps.reduce((s, t) => s + t.cap, 0);
        const cap = sumCap > 0 ? sumCap : 999; // 템플릿 없으면 오픈 처리
        const used = usedByDay.get(key) || 0;
        const isClosed = closedMap.has(key);
        result[key] = isClosed ? "CLOSED" : used >= cap ? "FULL" : "OPEN";
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      }

      const json = JSON.stringify(result);
      const etag = `"W/${createHash("sha1").update(json).digest("base64")}"`;
      const inm = req.headers.get("if-none-match");
      if (inm && inm === etag) return new NextResponse(null, { status: 304, headers: { "cache-control": CC_PUBLIC, etag } });
      return new NextResponse(json, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": CC_PUBLIC, etag } });
    }

    // (B) 상세(from/to/resources)
    const fromDate = parseISO(fromStr);
    const toDate = parseISO(toStr);
    if (!fromDate || !toDate) return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 400, headers: { "cache-control": "no-store" } });
    if (toDate < fromDate) return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 400, headers: { "cache-control": "no-store" } });

    const reqKeysRaw = (resourcesParam ? resourcesParam.split(",") : []).map((s) => s.trim());
    const reqKeysNorm = Array.from(new Set(reqKeysRaw.map(normResKey).filter((x): x is ResKey => !!x)));
    if (!reqKeysNorm.includes("basic")) reqKeysNorm.unshift("basic");

    const fromStart = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
    const toNextStart = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1, 0, 0, 0, 0);

    const templates = await prisma.slotTemplate.findMany({
      where: { hospitalId: hosp.id },
      select: { dow: true, start: true, end: true, capacity: true },
      orderBy: { start: "asc" },
    });

    const slotsByDow: Record<number, { time: string; cap: number }[]> = {};
    for (const t of templates) {
      const [sh, sm] = t.start.split(":").map(Number);
      const [eh, em] = t.end.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const times: string[] = [];
      for (let m0 = startMin; m0 <= endMin; m0 += 30) {
        const h = Math.floor(m0 / 60);
        const mm = m0 % 60;
        times.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
      }
      slotsByDow[t.dow] = times.map((time) => ({ time, cap: t.capacity }));
    }

    const closedMap = await findClosedDates(hosp.id, fromStart, toNextStart);

    const activeStatuses = ["PENDING", "RESERVED", "CONFIRMED"] as const;
    const bookings = await prisma.booking.findMany({
      where: {
        hospitalId: hosp.id,
        date: { gte: fromStart, lt: toNextStart },
        status: { in: activeStatuses as any },
      },
      select: { date: true },
    });
    const usedByDay = new Map<YMD, number>();
    for (const b of bookings) {
      usedByDay.set(toYMD(b.date), (usedByDay.get(toYMD(b.date)) || 0) + 1);
    }

    const days: Record<YMD, Partial<Record<string, { cap: number; used: number; closed?: boolean }>>> = {};
    let cur = new Date(fromStart);
    while (cur < toNextStart) {
      const key = toYMD(cur);
      const temps = slotsByDow[cur.getDay()] || [];
      const sumCap = temps.reduce((s, t) => s + t.cap, 0);
      const cap = sumCap > 0 ? sumCap : 999;
      const used = usedByDay.get(key) || 0;
      const closed = closedMap.has(key);

      const box: Partial<Record<string, { cap: number; used: number; closed?: boolean }>> = {};
      for (const rk of reqKeysNorm) {
        const v = { cap, used, closed };
        box[rk] = v;
        if (rk === "col") box["cscope"] = v; // alias
      }
      days[key] = box;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }

    const body = { ok: true, days };
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

