// app/api/capacity/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type YMD = `${number}-${number}-${number}`;
type ResKey = "basic" | "egd" | "col";

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0",
  )}` as YMD;

const parseMonth = (s: string) => {
  // "2025-10" → [start, nextStart]
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

export async function GET(req: NextRequest) {
  try {
    // month=YYYY-MM
    const url = new URL(req.url);
    const month = url.searchParams.get("month") || "";
    const rng = parseMonth(month);
    if (!rng) return NextResponse.json({ ok: false, error: "INVALID_MONTH" }, { status: 400 });
    const [fromStart, toNextStart] = rng;

    // (관리자 컨텍스트) 하나의 병원만 쓰는 환경 가정: 가장 첫 병원 id 사용
    // 기존 프로젝트엔 세션에서 병원 id를 잡는 유틸이 있을 텐데, 그걸 쓰셔도 됩니다.
    const hosp =
      (await prisma.hospital.findFirst({ select: { id: true } })) ||
      null;
    if (!hosp) return NextResponse.json({ ok: false, error: "HOSP_NOT_FOUND" }, { status: 404 });

    // --- 요일 템플릿 → 일자별 cap 합계 산정
    const templates = await prisma.slotTemplate.findMany({
      where: { hospitalId: hosp.id },
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

    // --- 리소스 별 마감 수집
    // capacityOverride: 리소스(type)별 isClosed
    // slotException / dayClose / holiday(closed=1) / calendarClose : 날짜 자체 마감 → basic
    const closedMap = new Map<YMD, Set<ResKey>>();
    const addClosed = (date: Date, res: ResKey) => {
      const iso = toYMD(date);
      const set = closedMap.get(iso) || new Set<ResKey>();
      set.add(res);
      closedMap.set(iso, set);
    };

    // 리소스별 마감
    try {
      const cos = await (prisma as any).capacityOverride.findMany({
        where: { hospitalId: hosp.id, date: { gte: fromStart, lt: toNextStart }, isClosed: true },
        select: { date: true, type: true },
      });
      for (const r of cos) addClosed(r.date, toResKey(r.type) || "basic");
    } catch {}

    // 날짜 자체 마감 → basic
    const legacyModels = [
      { model: "slotException", select: { date: true } },
      { model: "calendarClose", select: { date: true } },
      { model: "dayClose", select: { date: true } },
    ] as const;
    for (const lg of legacyModels) {
      try {
        const rows = await (prisma as any)[lg.model].findMany({
          where: { hospitalId: hosp.id, date: { gte: fromStart, lt: toNextStart } },
          select: lg.select,
        });
        for (const r of rows) addClosed(r.date, "basic");
      } catch {}
    }
    // holiday(closed=true)도 basic
    try {
      const holis = await (prisma as any).holiday.findMany({
        where: { hospitalId: hosp.id, date: { gte: fromStart, lt: toNextStart }, closed: true },
        select: { date: true },
      });
      for (const r of holis) addClosed(r.date, "basic");
    } catch {}

    // --- 사용량(일 단위 합계)
    const active = ["PENDING", "RESERVED", "CONFIRMED"] as const;
    const books = await prisma.booking.findMany({
      where: { hospitalId: hosp.id, date: { gte: fromStart, lt: toNextStart }, status: { in: active as any } },
      select: { date: true },
    });
    const usedByDay = new Map<YMD, number>();
    for (const b of books) {
      const iso = toYMD(b.date);
      usedByDay.set(iso, (usedByDay.get(iso) || 0) + 1);
    }

    // --- 달력 데이터 구성 (관리자용: 모든 리소스 상태 동시 제공)
    const days: Record<
      YMD,
      {
        cap: number;          // 합계 cap
        used: number;         // 합계 used
        closed: { basic: boolean; egd: boolean; col: boolean };
      }
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
        closed: {
          basic: set.has("basic"),
          egd: set.has("egd"),
          col: set.has("col"),
        },
      };
    }

    return NextResponse.json({ ok: true, days });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}

