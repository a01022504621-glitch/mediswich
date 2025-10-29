// app/api/capacity/calendar/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { cookies, headers } from "next/headers";
import { optionalSession } from "@/lib/auth/guard";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

type YMD = `${number}-${number}-${number}`;
type ResKey = "basic" | "egd" | "col";

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

const parseMonth = (s: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const y = +m[1];
  const m0 = +m[2] - 1;
  const start = new Date(y, m0, 1, 0, 0, 0, 0);
  const next = new Date(y, m0 + 1, 1, 0, 0, 0, 0);
  return [start, next] as const;
};

const toResKey = (v?: string | null): ResKey | null => {
  const s = String(v || "").toLowerCase();
  if (!s) return null;
  if (s === "basic" || s.includes("기본")) return "basic";
  if (s === "egd" || s.includes("위") || s.includes("경비")) return "egd";
  if (s === "col" || s.includes("cscope") || s.includes("대장")) return "col";
  return null;
};

// ── 유틸: 날짜 파서 ────────────────────────────────────────────────────────────
function parseAnyDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pickFromMeta(meta: any, keys: string[]): Date | null {
  try {
    const obj = typeof meta === "string" ? JSON.parse(meta) : meta || {};
    for (const k of keys) {
      const d = parseAnyDate(obj?.[k]);
      if (d) return d;
    }
  } catch {}
  return null;
}

// 완료일 > 확정일 > 예약일
function effectiveDate(row: { date: Date; meta?: any }): Date {
  const done =
    pickFromMeta(row.meta, ["completedDate", "검진완료일", "completeDate", "completed_at", "doneAt", "finishedAt"]) || null;
  const confirmed =
    pickFromMeta(row.meta, [
      "confirmedDate",
      "예약확정일",
      "reserveConfirmedAt",
      "confirmed_at",
      "reservationConfirmedAt",
      "reservedDate",
    ]) || null;
  return (done || confirmed || row.date) as Date;
}

// ── 병원 스코프 해석: 쿠키 → 쿼리 → 세션 → 호스트 ─────────────────────────────
async function resolveHospitalId(req: NextRequest): Promise<string | null> {
  try {
    const url = new URL(req.url);
    const hidFromQuery = url.searchParams.get("hid") || "";
    const ck = cookies();
    const hd = headers();

    const hidFromCookie = ck.get("current_hospital_id")?.value || "";

    let hidFromSession = "";
    try {
      const session = await optionalSession(); // 공개에서도 실패 허용
      hidFromSession = (session as any)?.hid || (session as any)?.hospitalId || "";
    } catch {
      // ignore
    }

    const host = hd.get("x-forwarded-host") ?? hd.get("host") ?? "";
    let hidFromHost = "";
    try {
      const t = await resolveTenantHybrid({ host });
      hidFromHost = t?.id || "";
    } catch {
      // ignore
    }

    const hid = hidFromCookie || hidFromQuery || hidFromSession || hidFromHost || "";
    return hid || null;
  } catch {
    return null;
  }
}

// ── 핸들러 ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month") || "";
    const rng = parseMonth(month);
    if (!rng) return NextResponse.json({ ok: false, error: "INVALID_MONTH" }, { status: 400 });
    const [fromStart, toNextStart] = rng;

    const hospitalId = await resolveHospitalId(req);
    if (!hospitalId) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 400 });

    // 요일 템플릿 → cap 합산
    const templates = await prisma.slotTemplate.findMany({
      where: { hospitalId },
      select: { dow: true, start: true, end: true, capacity: true },
      orderBy: { start: "asc" },
    });

    const capByDow: Record<number, number> = {};
    for (const t of templates) {
      const [sh, sm] = t.start.split(":").map(Number);
      const [eh, em] = t.end.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const slots = Math.max(0, Math.floor((endMin - startMin) / 30) + 1);
      capByDow[t.dow] = (capByDow[t.dow] || 0) + slots * (t.capacity || 0);
    }

    // 마감 수집
    const closedMap = new Map<YMD, Set<ResKey>>();
    const addClosed = (date: Date, res: ResKey) => {
      const iso = toYMD(date);
      const set = closedMap.get(iso) || new Set<ResKey>();
      set.add(res);
      closedMap.set(iso, set);
    };

    try {
      const cos = await (prisma as any).capacityOverride.findMany({
        where: { hospitalId, date: { gte: fromStart, lt: toNextStart }, isClosed: true },
        select: { date: true, type: true },
      });
      for (const r of cos) addClosed(r.date, toResKey((r as any).type) || "basic");
    } catch {}

    for (const lg of [
      { model: "slotException", select: { date: true } },
      { model: "calendarClose", select: { date: true } },
      { model: "dayClose", select: { date: true } },
    ] as const) {
      try {
        const rows = await (prisma as any)[lg.model].findMany({
          where: { hospitalId, date: { gte: fromStart, lt: toNextStart } },
          select: lg.select,
        });
        for (const r of rows) addClosed((r as any).date, "basic");
      } catch {}
    }

    try {
      const holis = await (prisma as any).holiday.findMany({
        where: { hospitalId, date: { gte: fromStart, lt: toNextStart }, closed: true },
        select: { date: true },
      });
      for (const r of holis) addClosed((r as any).date, "basic");
    } catch {}

    // 사용량 집계
    const books = await prisma.booking.findMany({
      where: {
        hospitalId,
        date: {
          gte: new Date(fromStart.getFullYear(), fromStart.getMonth() - 1, 1),
          lt: new Date(toNextStart.getFullYear(), toNextStart.getMonth() + 1, 1),
        },
      },
      select: { date: true, meta: true },
    });

    const usedByDay = new Map<YMD, number>();
    for (const b of books) {
      const eff = effectiveDate(b as any);
      if (eff >= fromStart && eff < toNextStart) {
        const iso = toYMD(eff);
        usedByDay.set(iso, (usedByDay.get(iso) || 0) + 1);
      }
    }

    // 응답
    const days: Record<
      YMD,
      { cap: number; used: number; closed: { basic: boolean; egd: boolean; col: boolean } }
    > = {};

    for (let d = new Date(fromStart); d < toNextStart; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const iso = toYMD(d);
      const dow = d.getDay();
      const cap = (capByDow[dow] ?? 0) > 0 ? capByDow[dow]! : 999;
      const used = usedByDay.get(iso) || 0;
      const set = closedMap.get(iso) || new Set<ResKey>();
      days[iso] = {
        cap,
        used,
        closed: { basic: set.has("basic"), egd: set.has("egd"), col: set.has("col") },
      };
    }

    return NextResponse.json({ ok: true, days });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}




