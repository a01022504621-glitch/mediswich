// app/api/m/dashboard/trends/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import {
  startOfDay,
  addDays,
  parseYMD,
  formatYMD,
  rangeDays,
  weekStartMonday,
  groupKeyDay,
  groupKeyWeek,
} from "@/lib/metrics/date";

type Gran = "day" | "week";
const ACTIVE: Array<"PENDING" | "RESERVED" | "CONFIRMED"> = ["PENDING", "RESERVED", "CONFIRMED"];

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 401 });

    const url = new URL(req.url);
    const fromStr = (url.searchParams.get("from") || "").trim();
    const toStr = (url.searchParams.get("to") || "").trim();
    const gran = ((url.searchParams.get("gran") || "day").trim() as Gran) || "day";

    const from = parseYMD(fromStr) ?? startOfDay(addDays(new Date(), -13));
    const to = addDays(parseYMD(toStr) ?? startOfDay(new Date()), 1);

    const rows = await runAs(hospitalId, () =>
      prisma.booking.findMany({
        where: {
          hospitalId,
          OR: [
            { effectiveDate: { gte: from, lt: to } },
            { createdAt: { gte: from, lt: to } },
          ],
        },
        select: { id: true, status: true, createdAt: true, effectiveDate: true, packageId: true },
      }),
    );

    const keyFn = gran === "week" ? groupKeyWeek : groupKeyDay;
    const buckets = new Map<string, { requested: number; active: number; confirmed: number; canceled: number }>();

    // seed buckets for full range
    const days = rangeDays(startOfDay(from), addDays(startOfDay(to), -1));
    for (const d of days) buckets.set(keyFn(d), { requested: 0, active: 0, confirmed: 0, canceled: 0 });

    for (const b of rows) {
      // requested by createdAt
      const kr = keyFn(startOfDay(b.createdAt));
      const r = buckets.get(kr);
      if (r) r.requested += 1;

      // status by effectiveDate
      const dEff = b.effectiveDate ? startOfDay(b.effectiveDate) : null;
      if (dEff && dEff >= from && dEff < to) {
        const k = keyFn(dEff);
        const box = buckets.get(k);
        if (!box) continue;
        if (b.status === "CANCELED") box.canceled += 1;
        if (b.status === "CONFIRMED" || b.status === "COMPLETED" || b.status === "AMENDED") box.confirmed += 1;
        if (ACTIVE.includes(b.status as any)) box.active += 1;
      }
    }

    const data = Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => ({ key: k, ...v }));

    return NextResponse.json({ ok: true, gran, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}

