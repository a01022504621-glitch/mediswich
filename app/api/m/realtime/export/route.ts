// 경로: mediswich/app/api/m/realtime/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { buildRealtimeWorkbook } from "@/lib/excel/realtimeExport";
import type { DBBooking } from "@/lib/realtime/mapBookingToRow";

export async function GET(req: NextRequest) {
  try {
    const org = await requireOrg();

    const idsParam = req.nextUrl.searchParams.get("ids") || "";
    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "no ids" }, { status: 400 });
    }

    const rows = await prisma.booking.findMany({
      where: { hospitalId: org.id, id: { in: ids } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
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

    const wb = await buildRealtimeWorkbook(rows as unknown as DBBooking[]);
    const buf = await wb.xlsx.writeBuffer();

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `mediswitch-booking-${today}.xlsx`;

    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("Excel export error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}



