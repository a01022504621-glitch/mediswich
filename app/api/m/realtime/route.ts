// app/api/m/realtime/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
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

    const s = await requireSession();
    const hospitalId = s.hid;
    if (!hospitalId) return NextResponse.json({ error: "hospital_not_selected" }, { status: 401 });

    const fromDate = from ? new Date(from) : new Date(Date.UTC(year, 0, 1));
    const rawTo = to ? new Date(to) : new Date(Date.UTC(year + 1, 0, 1));
    const toDate = to
      ? new Date(Date.UTC(rawTo.getUTCFullYear(), rawTo.getUTCMonth(), rawTo.getUTCDate() + 1))
      : rawTo;

    const today = toYMDUTC(new Date());
    try {
      const candidates = await runAs(hospitalId, () =>
        prisma.booking.findMany({
          where: {
            hospitalId,
            OR: [{ status: "PENDING" }, { status: "RESERVED" }, { status: "CONFIRMED" }],
          },
          select: { id: true, meta: true },
        })
      );
      const overdue = candidates
        .filter((b) => isYMD((b.meta as any)?.confirmedDate))
        .filter((b) => ((b.meta as any).confirmedDate as string) < today);

      if (overdue.length) {
        await runAs(hospitalId, () =>
          prisma.$transaction(
            overdue.map((b) =>
              prisma.booking.update({
                where: { id: b.id },
                data: { status: "NO_SHOW" as any },
                select: { id: true },
              })
            )
          )
        );
      }
    } catch {}

    const rows = await runAs(hospitalId, () =>
      prisma.booking.findMany({
        where: {
          hospitalId,
          OR: [{ date: { gte: fromDate, lt: toDate } }, { createdAt: { gte: fromDate, lt: toDate } }],
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
      })
    );

    const codes = Array.from(
      new Set(rows.map((r) => String((r.meta as any)?.corpCode || "").trim()).filter((v) => v.length > 0))
    );

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
      const found = (await runAs(hospitalId, () =>
        (repo as any).findMany({
          where: { hospitalId, code: { in: codes } },
          select: { code: true, name: true },
        })
      )) as Array<{ code: string; name: string }>;
      nameByCode = new Map(found.map((c) => [String(c.code), String(c.name)]));
    }

    for (const r of rows) {
      const m: any = r.meta || {};
      if (!m.corpName && m.corpCode && nameByCode.has(String(m.corpCode))) {
        m.corpName = nameByCode.get(String(m.corpCode));
        (r as any).meta = m;
      }
    }

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



