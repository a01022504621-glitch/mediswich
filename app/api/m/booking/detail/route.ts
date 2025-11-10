export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

/**
 * GET /api/m/booking/detail?id=cmXXXXXXXX
 * 헤더/세션의 병원 스코프로 보호됨.
 */
export async function GET(req: NextRequest) {
  try {
    const sess = await requireSession(); // 세션에서 hid 확보
    const hid = sess?.hid || sess?.hospitalId;
    if (!hid) return NextResponse.json({ error: "NO_HOSPITAL" }, { status: 401 });

    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

    const row = await runAs(String(hid), () =>
      prisma.booking.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          hospitalId: true,
          packageId: true,
          date: true,
          time: true,
          status: true,
          name: true,
          phone: true,
          patientBirth: true,
          sex: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
          package: { select: { title: true, category: true, price: true } },
        },
      })
    );

    if (!row || row.hospitalId !== String(hid)) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: row }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}




