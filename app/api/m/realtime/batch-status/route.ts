// app/api/m/realtime/batch-status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";

/** KR/EN → DB BookingStatus 매핑 */
function mapStatus(input: string) {
  const s = String(input || "").trim().toUpperCase();
  const KR: Record<string, string> = {
    "예약신청": "PENDING",
    "예약확정": "CONFIRMED",
    "검진완료": "COMPLETED",
    "취소": "CANCELED",
    "검진미실시": "NO_SHOW",
  };
  if (KR[s]) return KR[s];
  if (["PENDING", "RESERVED", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"].includes(s)) return s;
  if (s === "RESERVE") return "RESERVED";
  return null;
}

function isYMD(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

export async function POST(req: NextRequest) {
  try {
    const org = await requireOrg(); // 병원 스코프
    const body = await req.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
    const statusRaw: string = body?.status;
    const confirmedDate: string | undefined = body?.confirmedDate;

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    const dbStatus = mapStatus(statusRaw);
    if (!dbStatus) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    if (dbStatus === "CONFIRMED" && !isYMD(confirmedDate)) {
      return NextResponse.json({ error: "confirmedDate must be YYYY-MM-DD for CONFIRMED" }, { status: 400 });
    }

    // 대상 예약 로드(병원 소속만)
    const bookings = await prisma.booking.findMany({
      where: { hospitalId: org.id, id: { in: ids } },
      select: { id: true, meta: true },
    });
    if (bookings.length === 0) {
      return NextResponse.json({ error: "no matching bookings" }, { status: 404 });
    }

    // 개별 업데이트(메타 머지)
    const tx = bookings.map((b) => {
      const meta = { ...(b.meta as any) };
      if (dbStatus === "CONFIRMED") {
        meta.confirmedDate = confirmedDate; // YYYY-MM-DD
      } else {
        // 확정 해제/다른 상태로 변경 시 confirmedDate 제거
        if (meta && typeof meta === "object") delete meta.confirmedDate;
      }
      return prisma.booking.update({
        where: { id: b.id },
        data: { status: dbStatus as any, meta },
        select: { id: true },
      });
    });

    const updated = await prisma.$transaction(tx);

    // 감사 로그(선택)
    try {
      await prisma.auditLog.createMany({
        data: updated.map((u) => ({
          hospitalId: org.id,
          action: "BOOKING_BATCH_STATUS",
          meta: {
            ids: ids,
            status: dbStatus,
            confirmedDate: dbStatus === "CONFIRMED" ? confirmedDate : null,
            updated: updated.map((x) => x.id),
          } as any,
        })),
        skipDuplicates: true,
      });
    } catch {
      // 로그 실패는 무시
    }

    return NextResponse.json({
      ok: true,
      updated: updated.length,
      status: dbStatus,
      confirmedDate: dbStatus === "CONFIRMED" ? confirmedDate : undefined,
      ids: updated.map((x) => x.id),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


