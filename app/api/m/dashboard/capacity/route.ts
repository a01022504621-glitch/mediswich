// app/api/m/dashboard/capacity/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { computeRangeCapacity } from "@/lib/metrics/capacity";
import { parseYMD, addDays, startOfDay, formatYMD } from "@/lib/metrics/date";

type YMD = `${number}-${number}-${number}`;

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "HOSPITAL_SCOPE_REQUIRED" }, { status: 401 });

    const url = new URL(req.url);
    const month = (url.searchParams.get("month") || "").trim();
    const fromStr = (url.searchParams.get("from") || "").trim();
    const toStr = (url.searchParams.get("to") || "").trim();

    let from: Date | null = null;
    let to: Date | null = null;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const y = +month.slice(0, 4);
      const m = +month.slice(5, 7) - 1;
      from = startOfDay(new Date(y, m, 1));
      to = startOfDay(new Date(y, m + 1, 1));
    } else if (fromStr && toStr) {
      const f = parseYMD(fromStr);
      const t = parseYMD(toStr);
      if (f && t) {
        from = startOfDay(f);
        to = addDays(startOfDay(t), 1);
      }
    }

    if (!from || !to || to <= from) {
      return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 400 });
    }

    const days = await computeRangeCapacity(hospitalId, from, to);
    return NextResponse.json(
      {
        ok: true,
        from: formatYMD(from),
        to: formatYMD(addDays(to, -1)),
        days,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}



