// lib/metrics/capacity.ts
import prisma, { runAs } from "@/lib/prisma-scope";
import { startOfDay, addDays } from "./date";
import { readDefaultCapOrZero } from "@/lib/repos/capacitySettings.repo";

type YMD = `${number}-${number}-${number}`;
type ResKey = "basic" | "egd" | "col";

const ACTIVE: Array<"PENDING" | "RESERVED" | "CONFIRMED"> = ["PENDING", "RESERVED", "CONFIRMED"];

function toYMD(d: Date): YMD {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;
}

function times30(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const a = sh * 60 + sm;
  const b = eh * 60 + em;
  if (b < a) return 0;
  return Math.floor((b - a) / 30) + 1;
}

async function defaultBasicCap(hospitalId: string): Promise<number> {
  const defs = await readDefaultCapOrZero(hospitalId);
  return Number(defs?.BASIC || 0);
}

async function hardClosedByRes(hospitalId: string, from: Date, to: Date) {
  const map = new Map<YMD, { basic?: boolean; egd?: boolean; col?: boolean }>();
  const put = (d: Date, k: ResKey) => {
    const key = toYMD(d);
    const cur = map.get(key) || {};
    cur[k] = true;
    map.set(key, cur);
  };

  const [overrides, slotExceptions, calendarCloses, dayCloses, holidays] = await runAs(hospitalId, () =>
    Promise.all([
      (prisma as any).capacityOverride.findMany({
        where: { hospitalId, date: { gte: from, lt: to }, isClosed: true },
        select: { date: true, type: true },
      }),
      (prisma as any).slotException.findMany({ where: { hospitalId, date: { gte: from, lt: to } }, select: { date: true } }),
      (prisma as any).calendarClose?.findMany
        ? (prisma as any).calendarClose.findMany({ where: { hospitalId, date: { gte: from, lt: to } }, select: { date: true } })
        : [],
      (prisma as any).dayClose?.findMany
        ? (prisma as any).dayClose.findMany({ where: { hospitalId, date: { gte: from, lt: to } }, select: { date: true } })
        : [],
      (prisma as any).holiday?.findMany
        ? (prisma as any).holiday.findMany({ where: { hospitalId, date: { gte: from, lt: to }, closed: true }, select: { date: true } })
        : [],
    ]),
  );

  for (const r of overrides as Array<{ date: Date; type?: string }>) {
    const t = String(r?.type || "").toUpperCase();
    const res: ResKey = t === "EGD" ? "egd" : t === "COL" ? "col" : "basic";
    put(r.date, res);
  }
  for (const r of [...(slotExceptions as any[]), ...(calendarCloses as any[]), ...(dayCloses as any[]), ...(holidays as any[])]) {
    put(r.date, "basic");
  }
  return map; // key -> closed flags
}

async function capByDow(hospitalId: string): Promise<Record<number, number>> {
  const templates = await runAs(hospitalId, () =>
    prisma.slotTemplate.findMany({
      where: { hospitalId },
      select: { dow: true, start: true, end: true, capacity: true },
      orderBy: { start: "asc" },
    }),
  );
  const capBy: Record<number, number> = {};
  for (const t of templates) {
    const slots = times30(t.start, t.end);
    capBy[t.dow] = (capBy[t.dow] || 0) + slots * (t.capacity || 0);
  }
  return capBy;
}

export async function computeDailyCapacity(hospitalId: string, day: Date): Promise<{ cap: number; closed: { basic: boolean; egd: boolean; col: boolean } }> {
  const d = startOfDay(day);
  const next = addDays(d, 1);

  const [capMap, defBasic, closedMap, used] = await Promise.all([
    capByDow(hospitalId),
    defaultBasicCap(hospitalId),
    hardClosedByRes(hospitalId, d, next),
    runAs(hospitalId, () =>
      prisma.booking.count({
        where: { hospitalId, effectiveDate: { gte: d, lt: next }, status: { in: ACTIVE as any } },
      }),
    ),
  ]);

  const capFromTemplate = capMap[d.getDay()] || 0;
  const cap = capFromTemplate > 0 ? capFromTemplate : defBasic > 0 ? defBasic : 0;
  const closed = closedMap.get(toYMD(d)) || {};
  const isFull = cap > 0 && used >= cap;

  return { cap, closed: { basic: Boolean(closed.basic) || isFull, egd: Boolean(closed.egd) || Boolean(closed.basic) || isFull, col: Boolean(closed.col) || Boolean(closed.basic) || isFull } };
}

export async function computeRangeCapacity(
  hospitalId: string,
  from: Date,
  to: Date,
): Promise<Record<YMD, { cap: number; used: number; closed: { basic: boolean; egd: boolean; col: boolean } }>> {
  const f0 = startOfDay(from);
  const t0 = startOfDay(to);
  const [capMap, defBasic, closedMap, bookings] = await Promise.all([
    capByDow(hospitalId),
    defaultBasicCap(hospitalId),
    hardClosedByRes(hospitalId, f0, t0),
    runAs(hospitalId, () =>
      prisma.booking.findMany({
        where: { hospitalId, effectiveDate: { gte: f0, lt: t0 }, status: { in: ACTIVE as any } },
        select: { effectiveDate: true },
      }),
    ),
  ]);

  const usedBy = new Map<YMD, number>();
  for (const b of bookings) {
    const key = toYMD(startOfDay(b.effectiveDate!));
    usedBy.set(key, (usedBy.get(key) || 0) + 1);
  }

  const out: Record<YMD, { cap: number; used: number; closed: { basic: boolean; egd: boolean; col: boolean } }> = {};

  for (let d = new Date(f0); d < t0; d = addDays(d, 1)) {
    const key = toYMD(d);
    const capFromTemplate = capMap[d.getDay()] || 0;
    const cap = capFromTemplate > 0 ? capFromTemplate : defBasic > 0 ? defBasic : 0;
    const used = usedBy.get(key) || 0;
    const hard = closedMap.get(key) || {};
    const isFull = cap > 0 && used >= cap;

    out[key] = {
      cap,
      used,
      closed: {
        basic: Boolean(hard.basic) || isFull,
        egd: Boolean(hard.egd) || Boolean(hard.basic) || isFull,
        col: Boolean(hard.col) || Boolean(hard.basic) || isFull,
      },
    };
  }
  return out;
}

