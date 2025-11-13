// app/api/m/dashboard/series/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

type YMD = `${number}-${number}-${number}`;
const ymd = (d: Date): YMD =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function daterange(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const lim = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (d <= lim) {
    out.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "NO_HOSPITAL" }, { status: 401 });

    const url = new URL(req.url);
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    if (!from || !to) return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 400 });

    const [rows, logs] = await Promise.all([
      prisma.booking.findMany({
        where: { hospitalId, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, status: true },
      }),
      prisma.bookingChangeLog.findMany({
        where: { createdAt: { gte: from, lte: to }, booking: { hospitalId } },
        select: { createdAt: true },
      }),
    ]);

    const map = new Map<
      YMD,
      { requested: number; confirmed: number; completed: number; amended: number }
    >();
    for (const d of daterange(from, to)) map.set(ymd(d), { requested: 0, confirmed: 0, completed: 0, amended: 0 });

    for (const r of rows) {
      const iso = ymd(r.createdAt);
      const box = map.get(iso)!;
      box.requested += 1;
      if (r.status === "CONFIRMED") box.confirmed += 1;
      if (r.status === "COMPLETED") box.completed += 1;
    }
    for (const lg of logs) {
      const iso = ymd(lg.createdAt);
      const box = map.get(iso);
      if (box) box.amended += 1;
    }

    const series = Array.from(map.entries()).map(([d, v]) => ({ d, ...v }));
    return NextResponse.json({ ok: true, series });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL" }, { status: 500 });
  }
}




