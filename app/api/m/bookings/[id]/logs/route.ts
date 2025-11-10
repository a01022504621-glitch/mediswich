// app/api/m/bookings/[id]/logs/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/session";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = String((s as any).hid || (s as any).hospitalId || "");
    const id = ctx.params.id;

    // 소속 검증
    const owned = await prisma.booking.findFirst({
      where: { id, hospitalId: hid },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const logs = await (prisma as any).bookingChangeLog.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, actor: true, diff: true, createdAt: true },
    });

    return NextResponse.json({
      items: logs.map((l: any) => ({
        id: l.id,
        actor: l.actor || null,
        createdAt: l.createdAt,
        diff: l.diff || {},
      })),
      total: logs.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}



