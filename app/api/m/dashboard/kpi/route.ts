// app/api/m/dashboard/kpi/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

/* utils */
function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "NO_HOSPITAL" }, { status: 401 });

    const url = new URL(req.url);
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const todayOnly = url.searchParams.get("todayOnly") === "1";

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const rangeFrom = from ?? new Date(todayStart.getTime() - 6 * 86400000); // default 최근7일
    const rangeTo = to ?? todayEnd;

    /* helpers */
    const countRequested = async (f: Date, t: Date) =>
      prisma.booking.count({ where: { hospitalId, createdAt: { gte: f, lte: t } } });
    const countConfirmed = async (f: Date, t: Date) =>
      prisma.booking.count({
        where: { hospitalId, createdAt: { gte: f, lte: t }, status: "CONFIRMED" },
      });
    const countCompleted = async (f: Date, t: Date) =>
      prisma.booking.count({
        where: { hospitalId, createdAt: { gte: f, lte: t }, status: "COMPLETED" },
      });
    const countAmended = async (f: Date, t: Date) =>
      prisma.bookingChangeLog.count({
        where: { createdAt: { gte: f, lte: t }, booking: { hospitalId } },
      });

    const today = {
      requested: await countRequested(todayStart, todayEnd),
      confirmed: await countConfirmed(todayStart, todayEnd),
      amended: await countAmended(todayStart, todayEnd),
      completed: await countCompleted(todayStart, todayEnd),
    };

    const window = todayOnly
      ? null
      : {
          requested: await countRequested(rangeFrom, rangeTo),
          confirmed: await countConfirmed(rangeFrom, rangeTo),
          amended: await countAmended(rangeFrom, rangeTo),
          completed: await countCompleted(rangeFrom, rangeTo),
        };

    return NextResponse.json({ ok: true, today, window, range: { from: rangeFrom, to: rangeTo } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL" }, { status: 500 });
  }
}



