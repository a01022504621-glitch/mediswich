// mediswich/app/api/m/realtime/batch-status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";

/** YYYY-MM-DD 검사 */
function isYMD(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

/** KR/EN → DB BookingStatus 매핑 */
function mapStatus(input?: string | null) {
  const s = String(input || "").trim().toUpperCase();
  if (["PENDING", "RESERVED", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"].includes(s)) return s;
  if (s === "RESERVE") return "RESERVED";
  const KR: Record<string, string> = {
    "예약신청": "PENDING",
    "예약확정": "CONFIRMED",
    "검진완료": "COMPLETED",
    "취소": "CANCELED",
    "검진미실시": "NO_SHOW",
  };
  return KR[s] || null;
}

type UpdateIn = { id: string; status?: string; confirmedDate?: string | null; completedDate?: string | null };

export async function POST(req: NextRequest) {
  try {
    const org = await requireOrg();

    const body = await req.json();
    const updates: UpdateIn[] = Array.isArray(body?.updates) ? body.updates : [];
    if (!updates.length) return NextResponse.json({ error: "updates required" }, { status: 400 });

    // id 중복 제거(마지막 지시 우선)
    const lastById = new Map<string, UpdateIn>();
    for (const u of updates) if (u?.id) lastById.set(u.id, u);
    const ids = [...lastById.keys()];

    // 대상 로드
    const bookings = await prisma.booking.findMany({
      where: { hospitalId: org.id, id: { in: ids } },
      select: { id: true, status: true, meta: true },
    });
    const byId = new Map(bookings.map(b => [b.id, b]));

    const tx: any[] = [];

    // 스킵 사유 집계(프론트 안내용)
    const skipped = {
      notFound: [] as string[],
      alreadyConfirmed: [] as string[],
      alreadyCompleted: [] as string[],
      needConfirmedForCompleted: [] as string[],
      invalidConfirmedDate: [] as string[],
      invalidCompletedDate: [] as string[],
    };

    for (const [id, u] of lastById) {
      const cur = byId.get(id);
      if (!cur) {
        skipped.notFound.push(id);
        continue;
      }

      const next = mapStatus(u.status);
      if (!next) continue; // 알 수 없는 상태는 무시

      const meta = { ...(cur.meta as any) };

      if (next === "CONFIRMED") {
        if (cur.status === "CONFIRMED" || cur.status === "COMPLETED") {
          skipped.alreadyConfirmed.push(id);
          continue;
        }
        if (!isYMD(u.confirmedDate)) {
          skipped.invalidConfirmedDate.push(id);
          continue;
        }
        meta.confirmedDate = u.confirmedDate;
        delete meta.completedDate;

        tx.push(
          prisma.booking.update({
            where: { id },
            data: { status: "CONFIRMED" as any, meta },
            select: { id: true },
          }),
        );
      } else if (next === "COMPLETED") {
        if (cur.status === "COMPLETED") {
          skipped.alreadyCompleted.push(id);
          continue;
        }
        if (!isYMD(u.completedDate)) {
          skipped.invalidCompletedDate.push(id);
          continue;
        }
        if (!meta?.confirmedDate) {
          skipped.needConfirmedForCompleted.push(id);
          continue;
        }
        meta.completedDate = u.completedDate;

        tx.push(
          prisma.booking.update({
            where: { id },
            data: { status: "COMPLETED" as any, meta },
            select: { id: true },
          }),
        );
      } else {
        // 다른 상태로 변경 시 날짜 초기화
        delete meta.confirmedDate;
        delete meta.completedDate;

        tx.push(
          prisma.booking.update({
            where: { id },
            data: { status: next as any, meta },
            select: { id: true },
          }),
        );
      }
    }

    if (!tx.length) {
      return NextResponse.json({ ok: true, updated: 0, skipped });
    }

    const updated = await prisma.$transaction(tx);

    // 감사 로그
    try {
      await prisma.auditLog.create({
        data: {
          hospitalId: org.id,
          action: "BOOKING_BATCH_STATUS",
          meta: { input: updates, updated: updated.map(x => x.id), skipped } as any,
        },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      updated: updated.length,
      updatedIds: updated.map(x => x.id),
      skipped,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}



