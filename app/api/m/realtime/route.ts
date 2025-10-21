// mediswich/app/api/m/realtime/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { mapBookingToRow, type DBBooking } from "@/lib/realtime/mapBookingToRow";

/** UTC YYYY-MM-DD */
const toYMDUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;

const isYMD = (s?: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(s));

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const year = Number(sp.get("year") || new Date().getUTCFullYear());
    const from = sp.get("from");
    const to = sp.get("to");

    const org = await requireOrg();
    const hospitalId = org.id;

    // 기간: [fromDate, toDate)
    const fromDate = from ? new Date(from) : new Date(Date.UTC(year, 0, 1));
    const rawTo = to ? new Date(to) : new Date(Date.UTC(year + 1, 0, 1));
    const toDate = to
      ? new Date(Date.UTC(rawTo.getUTCFullYear(), rawTo.getUTCMonth(), rawTo.getUTCDate() + 1))
      : rawTo;

    // 자동 NO_SHOW 처리: 확정일 지남 + 미완료
    const today = toYMDUTC(new Date());
    try {
      const candidates = await prisma.booking.findMany({
        where: {
          hospitalId,
          OR: [{ status: "PENDING" }, { status: "RESERVED" }, { status: "CONFIRMED" }],
        },
        select: { id: true, meta: true },
      });
      const overdue = candidates
        .filter((b) => isYMD((b.meta as any)?.confirmedDate))
        .filter((b) => ((b.meta as any).confirmedDate as string) < today);
      if (overdue.length) {
        await prisma.$transaction(
          overdue.map((b) =>
            prisma.booking.update({
              where: { id: b.id },
              data: { status: "NO_SHOW" as any },
              select: { id: true },
            }),
          ),
        );
      }
    } catch {}

    // 서버는 예약희망일(date) 또는 예약신청일(createdAt)이 기간에 걸리면 포함
    const rows = await prisma.booking.findMany({
      where: {
        hospitalId,
        OR: [
          { date: { gte: fromDate, lt: toDate } },
          { createdAt: { gte: fromDate, lt: toDate } },
        ],
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        patientBirth: true,
        date: true,
        time: true,
        status: true,
        createdAt: true,
        meta: true,
        package: { select: { title: true, category: true } },
      },
    });

    // ── 핵심 추가: corpCode → 고객사명 보강 ─────────────────────────────
    const codes = Array.from(
      new Set(
        rows
          .map((r) => String((r.meta as any)?.corpCode || "").trim())
          .filter((v) => v.length > 0),
      ),
    );

    // prisma 모델명이 프로젝트마다 다를 수 있어 안전하게 탐색
    const repo =
      (prisma as any).client ||
      (prisma as any).clients ||
      (prisma as any).corpClient ||
      (prisma as any).corp ||
      (prisma as any).company ||
      (prisma as any).customer ||
      (prisma as any).orgClient;

    let nameByCode = new Map<string, string>();
    if (repo && codes.length) {
      const found = await repo.findMany({
        where: { hospitalId, code: { in: codes } },
        select: { code: true, name: true },
      });
      nameByCode = new Map(found.map((c: any) => [String(c.code), String(c.name)]));
    }

    // 각 예약 meta에 corpName이 없고 corpCode가 있으면 이름 보강
    for (const r of rows) {
      const m: any = r.meta || {};
      if (!m.corpName && m.corpCode && nameByCode.has(String(m.corpCode))) {
        m.corpName = nameByCode.get(String(m.corpCode));
        // mapBookingToRow가 읽을 수 있도록 meta에 반영
        (r as any).meta = m;
      }
    }
    // ───────────────────────────────────────────────────────────────

    const items = (rows as unknown as DBBooking[]).map(mapBookingToRow);

    return NextResponse.json({
      items,
      total: items.length,
      range: { from: toYMDUTC(fromDate), to: toYMDUTC(new Date(toDate.getTime() - 86400000)) },
    });
  } catch (e: any) {
    console.error("API Error in /api/m/realtime:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}



