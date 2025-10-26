export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/vaccines/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
// (나중에 prisma 연결할 때 getCtx()로 병원 ID 필터링)

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "today";
  // TODO: date 파싱 & DB 조회 (지금은 스텁으로 0/빈배열 반환)
  return NextResponse.json({
    items: [], // 예약 목록
    totals: { reserved: 0, checked_in: 0, done: 0, no_show: 0 },
    date,
  });
}

