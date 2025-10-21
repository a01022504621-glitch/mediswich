// app/api/public/[tenant]/capacity/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type YMD = `${number}-${number}-${number}`;
type ResKey = "basic" | "egd" | "col";
type CloseState = { basic?: boolean; egd?: boolean; col?: boolean };

const CC_PUBLIC = "public, s-maxage=60, stale-while-revalidate=600";

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

const parseISO = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
};

const etagOf = (json: string) => `W/"${createHash("sha1").update(json).digest("base64")}"`;

/* ── 리소스 키 정규화 ── */
function normResKey(s: string): ResKey | null {
  const k = s.trim().toLowerCase();
  if (k === "basic") return "basic";
  if (k === "egd" || k === "gast" || k === "upper" || k === "gastroscopy" || k === "upper-scope") return "egd";
  if (k === "col" || k === "cscope" || k === "colon" || k === "colonoscopy" || k === "c-scope") return "col";
  return null;
}

/* ── 기본 케파(없으면 0) ── */
async function getBasicDefaultCap(hospitalId: string): Promise<number> {
  const p: any = prisma as any;

  try {
    const row = await p.capacitySetting?.findFirst({ where: { hospitalId }, select: { defaults: true } });
    const n = Number(row?.defaults?.BASIC ?? 0);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {}

  try {
    const row = await p.setting?.findFirst({
      where: { hospitalId, key: { in: ["capacity.defaults", "capacity:defaults"] } },
      select: { value: true },
    });
    const j = typeof row?.value === "string" ? JSON.parse(row!.value) : row?.value;
    const n = Number(j?.defaults?.BASIC ?? j?.BASIC ?? 0);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {}

  return 0;
}

/* ── 마감 수집: 리소스별로 분리 반환 ── */
async function findClosedByResource(hospitalId: string, fromStart: Date, toNextStart: Date) {
  const map = new Map<YMD, CloseState>();
  const put = (d: Date, res: ResKey) => {
    const k = toYMD(d);
    const cur = map.get(k) || {};
    cur[res] = true;
    map.set(k, cur);
  };

  const p: any = prisma as any;

  // capacityOverride(type별 마감)
  try {
    const rows = await p.capacityOverride?.findMany({
      where: { hospitalId, date: { gte: fromStart, lt: toNextStart }, isClosed: true },
      select: { date: true, type: true },
    });
    for (const r of rows || []) {
      const t = String((r as any).type || "").toLowerCase();
      const norm = t
        ? (normResKey(t) as ResKey | null)
        : "basic";
      put((r as any).date, (norm || "basic") as ResKey);
    }
  } catch {}

  // 날짜 자체 마감 → basic
  const dateCloseModels = ["slotException", "calendarClose", "dayClose"] as const;
  for (const m of dateCloseModels) {
    try {
      const repo = p?.[m];
      if (!repo?.findMany) continue;
      const rows = await repo.findMany({
        where: { hospitalId, date: { gte: fromStart, lt: toNextStart } },
        select: { date: true },
      });
      for (const r of rows || []) put((r as any).date, "basic");
    } catch {}
  }

  // holiday(closed=1) → basic
  try {
    const rows = await p.holiday?.findMany({
      where: { hospitalId, date: { gte: fromStart, lt: toNextStart }, closed: true },
      select: { date: true },
    });
    for (const r of rows || []) put((r as any).date, "basic");
  } catch {}

  return map; // YMD -> { basic?:true, egd?:true, col?:true }
}

export async function GET(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    const url = new URL(req.url);
    const monthParam = (url.searchParams.get("month") || "").trim();
    const fromStr = (url.searchParams.get("from") || "").trim();
    const toStr = (url.searchParams.get("to") || "").trim();
    const resourcesParam = (url.searchParams.get("resources") || "").trim();

    const hosp = await prisma.hospital.findFirst({ where: { slug: params.tenant }, select: { id: true } });
    if (!hosp) {
      return NextResponse.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404, headers: { "cache-control": CC_PUBLIC } });
    }

    /* (A) month=YYYY-MM → 공개 달력 상태 맵
       규칙:
       - basic 마감만 반영한다. 특수(egd/col) 마감은 제외.
       - used >= cap(FULL)인 날은 공개 달력에서 CLOSED로 간주. */
    if (monthParam && !fromStr && !toStr) {
      const y = Number(monthParam.slice(0, 4));
      const m = Number(monthParam.slice(5, 7)) - 1;
      if (!Number.isFinite(y) || !Number.isFinite(m)) {
        return NextResponse.json({ ok: false, error: "INVALID_MONTH" }, { status: 400, headers: { "cache-control": "no-store" } });
      }
      const fromStart = new Date(y, m, 1, 0, 0, 0, 0);
      const toNextStart = new Date(y, m + 1, 1, 0, 0, 0, 0);

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

      const basicDefault = await getBasicDefaultCap(hosp.id);
      const closedRes = await findClosedByResource(hosp.id, fromStart, toNextStart);

      const activeStatuses = ["PENDING", "RESERVED", "CONFIRMED"] as const;
      const bookings = await prisma.booking.findMany({
        where: { hospitalId: hosp.id, date: { gte: fromStart, lt: toNextStart }, status: { in: activeStatuses as any } },
        select: { date: true },
      });
      const usedByDay = new Map<YMD, number>();
      for (const b of bookings) {
        const key = toYMD(b.date);
        usedByDay.set(key, (usedByDay.get(key) || 0) + 1);
      }

      const result: Record<YMD, "OPEN" | "CLOSED"> = {};
      for (let cur = new Date(fromStart); cur < toNextStart; cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)) {
        const key = toYMD(cur);
        const temps = slotsByDow[cur.getDay()] || [];
        const sumCap = temps.reduce((s, t) => s + t.cap, 0);
        const cap = sumCap > 0 ? sumCap : basicDefault > 0 ? basicDefault : 999;
        const used = usedByDay.get(key) || 0;

        const hardClosed = Boolean(closedRes.get(key)?.basic);
        const fullClosed = cap > 0 && used >= cap;

        result[key] = hardClosed || fullClosed ? "CLOSED" : "OPEN";
      }

      const json = JSON.stringify(result);
      const etag = etagOf(json);
      const inm = req.headers.get("if-none-match");
      if (inm && inm === etag) return new NextResponse(null, { status: 304, headers: { "cache-control": CC_PUBLIC, etag } });
      return new NextResponse(json, {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": CC_PUBLIC, etag },
      });
    }

    /* (B) 상세 (from/to/resources)
       규칙:
       - 리소스별 마감 반영.
       - basic이 CLOSED이거나 FULL이면 모든 리소스도 예약 불가.
       - 특수 마감만 있을 땐 해당 리소스만 닫힘. */
    const fromDate = parseISO(fromStr);
    const toDate = parseISO(toStr);
    if (!fromDate || !toDate || toDate < fromDate) {
      return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 400, headers: { "cache-control": "no-store" } });
    }

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

    const basicDefault = await getBasicDefaultCap(hosp.id);
    const closedRes = await findClosedByResource(hosp.id, fromStart, toNextStart);

    const activeStatuses = ["PENDING", "RESERVED", "CONFIRMED"] as const;
    const bookings = await prisma.booking.findMany({
      where: { hospitalId: hosp.id, date: { gte: fromStart, lt: toNextStart }, status: { in: activeStatuses as any } },
      select: { date: true },
    });
    const usedByDay = new Map<YMD, number>();
    for (const b of bookings) usedByDay.set(toYMD(b.date), (usedByDay.get(toYMD(b.date)) || 0) + 1);

    const days: Record<YMD, Partial<Record<string, { cap: number; used: number; closed?: boolean }>>> = {};
    for (let cur = new Date(fromStart); cur < toNextStart; cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)) {
      const key = toYMD(cur);
      const temps = slotsByDow[cur.getDay()] || [];
      const sumCap = temps.reduce((s, t) => s + t.cap, 0);
      const cap = sumCap > 0 ? sumCap : basicDefault > 0 ? basicDefault : 999;
      const used = usedByDay.get(key) || 0;

      const hardBasic = Boolean(closedRes.get(key)?.basic);
      const hardEgd = Boolean(closedRes.get(key)?.egd);
      const hardCol = Boolean(closedRes.get(key)?.col);

      const full = cap > 0 && used >= cap;

      const closedBasic = hardBasic || full;
      const closedEgd = closedBasic || hardEgd;
      const closedCol = closedBasic || hardCol;

      const box: Partial<Record<string, { cap: number; used: number; closed?: boolean }>> = {};
      for (const rk of reqKeysNorm) {
        const v = { cap, used, closed: rk === "basic" ? closedBasic : rk === "egd" ? closedEgd : closedCol };
        box[rk] = v;
        if (rk === "col") box["cscope"] = v; // alias
      }
      days[key] = box;
    }

    const body = { ok: true, days };
    const json = JSON.stringify(body);
    const etag = etagOf(json);
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


