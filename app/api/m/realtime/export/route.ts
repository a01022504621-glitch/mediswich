// app/api/m/realtime/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/auth";
import { buildRealtimeWorkbook } from "@/lib/excel/realtimeExport";

export async function GET(req: NextRequest) {
  try {
    const org = await requireOrg();
    const sp = req.nextUrl.searchParams;
    const idsParam = (sp.get("ids") || "").trim();
    if (!idsParam) return NextResponse.json({ error: "ids required" }, { status: 400 });
    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
    if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });

    const rows = await prisma.booking.findMany({
      where: { hospitalId: org.id, id: { in: ids } },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true, name: true, phone: true, patientBirth: true, date: true, time: true,
        status: true, createdAt: true, meta: true,
        package: { select: { title: true, category: true } },
      },
    });

    const file = await buildRealtimeWorkbook(rows);
    const filename = `mediswitch-booking-${new Date().toISOString().slice(0,10)}.xlsx`;
    return new NextResponse(file, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}



