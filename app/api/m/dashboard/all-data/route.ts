// app/api/m/dashboard/all-data/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  const todayOnly = u.searchParams.get("todayOnly") === "1";

  // 기간 미지정이면 오늘 KPI만
  if (!from || !to) {
    const today = await fetch(`${u.origin}/api/m/dashboard/kpi?todayOnly=1`, { cache: "no-store" }).then(r => r.json());
    return NextResponse.json(
      { ok: true, today, series: null, breakdown: null, kpi: null },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  }

  const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const [today, kpi, series, breakdown] = await Promise.all([
    fetch(`${u.origin}/api/m/dashboard/kpi?todayOnly=1`, { cache: "no-store" }).then(r => r.json()),
    fetch(`${u.origin}/api/m/dashboard/kpi?${q}`, { cache: "no-store" }).then(r => r.json()),
    fetch(`${u.origin}/api/m/dashboard/series?${q}`, { cache: "no-store" }).then(r => r.json()),
    fetch(`${u.origin}/api/m/dashboard/breakdown?${q}`, { cache: "no-store" }).then(r => r.json()),
  ]);

  return NextResponse.json(
    { ok: true, today, kpi, series, breakdown },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  );
}




