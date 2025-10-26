export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

export async function GET() {
  try {
    const s = await requireSession();
    const hid = s.hid ?? s.hospitalId;
    if (!hid) return NextResponse.json({ ok: false, error: "No hospital" }, { status: 200 });

    const h = await prisma.hospital.findUnique({
      where: { id: hid },
      select: { id: true, name: true, slug: true },
    });
    if (!h) return NextResponse.json({ ok: false, error: "Hospital not found" }, { status: 200 });

    return NextResponse.json({ ok: true, hospital: h });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}


