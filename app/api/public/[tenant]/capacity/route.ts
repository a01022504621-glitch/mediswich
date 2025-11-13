// app/api/public/[tenant]/capacity/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";
import { createHash } from "crypto";

type YMD = `${number}-${number}-${number}`;
type ResKey = "basic" | "egd" | "col";
type CloseState = { basic?: boolean; egd?: boolean; col?: boolean };

const CC_PUBLIC = "public, s-maxage=60, stale-while-revalidate=600";
const VARY_HOST = "host, x-forwarded-host";

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

const parseISO = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
};

const etagOf = (json: string) => `W/"${createHash("sha1").update(json).digest("base64")}"`;

function normResKey(s: string): ResKey | null {
  const k = s.trim().toLowerCase();
  if (k === "basic") return "basic";
  if (k === "egd" || k === "gast" || k === "upper" || k === "gastroscopy" || k === "upper-scope") return "egd";
  if (k === "col" || k === "cscope" || k === "colon" || k === "colonoscopy" || k === "c-scope") return "col";
  return null;
}

async function safeFindMany(repo: any, where: any, select: any) {
  try {
    if (!repo?.findMany) return [];
    return await repo.findMany({ where, select });
  } catch {
    return [];
  }
}
async function safeFindFirst(repo: any, where: any, select: any) {
  try {
    if (!repo?.findFirst) return null;
    return await repo.findFirst({ where, select });
  } catch {
    return null;
  }
}

async function getBasicDefaultCap(hospitalId: string): Promise<number> {
  const p: any = prisma as any;
  const [rowCap, rowSetting] = await Promise.all([
    safeFindFirst(p.capacitySetting, { hospitalId }, { defaults: true }),
    safeFindFirst(p.setting, { hospitalId, key: { in: ["capacity.defaults", "capacity:defaults"] } }, { value: true }),
  ]);

  const n1 = Number((rowCap as any)?.defaults?.BASIC ?? 0);
  if (Number.isFinite(n1) && n1 > 0) return n1;

  const j =
    typeof (rowSetting as any)?.value === "string"
      ? (() => {
          try {
            return JSON.parse((rowSetting as any).value);
          } catch {
            return {};
          }
        })()
      : (rowSetting as any)?.value;
  const n2 = Number(j?.defaults?.BASIC ?? j?.BASIC ?? 0);
  if (Number.isFinite(n2) && n2 > 0) return n2;

  return 0;
}

async function findClosedByResource(hospitalId: string, fromStart: Date, toNextStart: Date) {
  const map = new Map<YMD, CloseState>();
  const put = (d: Date, res: ResKey) => {
    const k = toYMD(d);
    const cur = map.get(k) || {};
    cur[res] = true;
    map.set(k, cur);
  };

  const p: any = prisma as any;

  const [overrides, slotExceptions, calendarCloses, dayCloses, holidays] = await Promise.all([
    safeFindMany(p.capacityOverride, { hospitalId, date: { gte: fromStart, lt: toNextStart }, isClosed: true }, { date: true, type: true }),
    safeFindMany(p.slotException, { hospitalId, date: { gte: fromStart, lt: toNextStart } }, { date: true }),
    safeFindMany(p.calendarClose, { hospitalId, date: { gte: fromStart, lt: toNextStart } }, { date: true }),
    safeFindMany(p.dayClose, { hospitalId, date: { gte: fromStart, lt: toNextStart } }, { date: true }),
    safeFindMany(p.holiday, { hospitalId, date: { gte: fromStart, lt: toNextStart }, closed: true }, { date: true }),
  ]);

  for (const r of overrides as any[]) {
    const t = String(r?.type || "").toLowerCase();
    const norm = t ? (normResKey(t) as ResKey | null) : "basic";
    put(r.date, (norm || "basic") as ResKey);
  }
  for (const r of [...slotExceptions, ...calendarCloses, ...dayCloses] as any[]) put(r.date, "basic");
  for (const r of holidays as any[]) put(r.date, "basic");

  return map;
}

function buildSlotsByDow(templates: Array<{ dow: number; start: string; end: string; capacity: number }>) {
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
  return slotsByDow;
}

function respondWithJSON(req: NextRequest, data: any) {
  const json = typeof data === "string" ? data : JSON.stringify(data);
  const etag = etagOf(json);
  const inm = req.headers.get("if-none-match");
  if (inm && inm === etag) {
    return new NextResponse(null, { status: 304, headers: { "cache-control": CC_PUBLIC, etag, vary: VARY_HOST } });
  }
  return new NextResponse(json, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": CC_PUBLIC, etag, vary: VARY_HOST },
  });
}

export async function GET(req: NextRequest, context: { params: { tenant: string } }) {
  try {
    const { params } = context;
    const url = new URL(req.url);
    const monthParam = (url.searchParams.get("month") || "").trim();
    const fromStr = (url.searchParams.get("from") || "").trim();
    const toStr = (url.searchParams.get("to") || "").trim();
    const resourcesParam = (url.searchParams.get("resources") || "").trim();

    const t = await resolveTenantHybrid({
      slug: params.tenant,
      host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
    });
    if (!t) {
      return NextResponse.json(
        { ok: false, error: "TENANT_NOT_FOUND" },
        { status: 404, headers: { "cache-control": CC_PUBLIC, vary: VARY_HOST } },
      );
    }
    const hospitalId = t.id;
    const activeStatuses = ["PENDING", "RESERVED", "CONFIRMED"] as const;

    if (monthParam && !fromStr && !toStr) {
      const y = Number(monthParam.slice(0, 4));
      const m = Number(monthParam.slice(5, 7)) - 1;
      if (!Number.isFinite(y) || !Number.isFinite(m)) {
        return NextResponse.json(
          { ok: false, error: "INVALID_MONTH" },
          { status: 400, headers: { "cache-control": "no-store", vary: VARY_HOST } },
        );
      }
      const fromStart = new Date(y, m, 1, 0, 0, 0, 0);
      const toNextStart = new Date(y, m + 1, 1, 0, 0, 0, 0);

      const [templates, basicDefault, closedRes, bookings] = await runAs(hospitalId, async () =>
        Promise.all([
          prisma.slotTemplate.findMany({
            where: { hospitalId },
            select: { dow: true, start: true, end: true, capacity: true },
            orderBy: { start: "asc" },
          }),
          getBasicDefaultCap(hospitalId),
          findClosedByResource(hospitalId, fromStart, toNextStart),
          prisma.booking.findMany({
            where: { hospitalId, date: { gte: fromStart, lt: toNextStart }, status: { in: activeStatuses as any } },
            select: { date: true },
          }),
        ]),
      );

      const slotsByDow = buildSlotsByDow(templates);
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
        const cap = sumCap > 0 ? sumCap : (basicDefault as number) > 0 ? (basicDefault as number) : 999;
        const used = usedByDay.get(key) || 0;

        const hardClosed = Boolean((closedRes as Map<YMD, CloseState>).get(key)?.basic);
        const fullClosed = cap > 0 && used >= cap;

        result[key] = hardClosed || fullClosed ? "CLOSED" : "OPEN";
      }

      return respondWithJSON(req, result);
    }

    const fromDate = parseISO(fromStr);
    const toDate = parseISO(toStr);
    if (!fromDate || !toDate || toDate < fromDate) {
      return NextResponse.json(
        { ok: false, error: "INVALID_RANGE" },
        { status: 400, headers: { "cache-control": "no-store", vary: VARY_HOST } },
      );
    }

    const reqKeysRaw = (resourcesParam ? resourcesParam.split(",") : []).map((s) => s.trim());
    const reqKeysNorm = Array.from(new Set(reqKeysRaw.map(normResKey).filter((x): x is ResKey => !!x)));
    if (!reqKeysNorm.includes("basic")) reqKeysNorm.unshift("basic");

    const fromStart = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
    const toNextStart = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1, 0, 0, 0, 0);

    const [templates, basicDefault, closedRes, bookings] = await runAs(hospitalId, async () =>
      Promise.all([
        prisma.slotTemplate.findMany({
          where: { hospitalId },
          select: { dow: true, start: true, end: true, capacity: true },
          orderBy: { start: "asc" },
        }),
        getBasicDefaultCap(hospitalId),
        findClosedByResource(hospitalId, fromStart, toNextStart),
        prisma.booking.findMany({
          where: { hospitalId, date: { gte: fromStart, lt: toNextStart }, status: { in: activeStatuses as any } },
          select: { date: true },
        }),
      ]),
    );

    const slotsByDow = buildSlotsByDow(templates);
    const usedByDay = new Map<YMD, number>();
    for (const b of bookings) usedByDay.set(toYMD(b.date), (usedByDay.get(toYMD(b.date)) || 0) + 1);

    const days: Record<YMD, Partial<Record<string, { cap: number; used: number; closed?: boolean }>>> = {};
    for (let cur = new Date(fromStart); cur < toNextStart; cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)) {
      const key = toYMD(cur);
      const temps = slotsByDow[cur.getDay()] || [];
      const sumCap = temps.reduce((s, t) => s + t.cap, 0);
      const cap = sumCap > 0 ? sumCap : (basicDefault as number) > 0 ? (basicDefault as number) : 999;
      const used = usedByDay.get(key) || 0;

      const hardBasic = Boolean((closedRes as Map<YMD, CloseState>).get(key)?.basic);
      const hardEgd = Boolean((closedRes as Map<YMD, CloseState>).get(key)?.egd);
      const hardCol = Boolean((closedRes as Map<YMD, CloseState>).get(key)?.col);

      const full = cap > 0 && used >= cap;

      const closedBasic = hardBasic || full;
      const closedEgd = closedBasic || hardEgd;
      const closedCol = closedBasic || hardCol;

      const box: Partial<Record<string, { cap: number; used: number; closed?: boolean }>> = {};
      for (const rk of reqKeysNorm) {
        const v = { cap, used, closed: rk === "basic" ? closedBasic : rk === "egd" ? closedEgd : closedCol };
        box[rk] = v;
        if (rk === "col") box["cscope"] = v;
      }
      days[key] = box;
    }

    return respondWithJSON(req, { ok: true, days });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL" },
      { status: 500, headers: { "cache-control": "no-store", vary: VARY_HOST } },
    );
  }
}




