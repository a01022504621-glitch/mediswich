export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/m/addons/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

async function assertOwned(id: string, hid: string) {
  const row = await prisma.addonItem.findUnique({ where: { id } });
  if (!row || row.hospitalId !== hid) throw new Error("NOT_FOUND");
  return row;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    await assertOwned(params.id, hid);

    const body = await req.json().catch(() => ({}));
    const data: any = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (body.sex === "M" || body.sex === "F") data.sex = body.sex;
    if (body.sex === "A") data.sex = null; // 전체
    if (typeof body.price === "number") data.priceKRW = Math.max(0, Math.trunc(body.price));
    if (typeof body.visible === "boolean") data.isActive = body.visible;

    const r = await prisma.addonItem.updateMany({ where: { id: params.id, hospitalId: hid }, data });
    if (r.count === 0) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    await prisma.auditLog.create({
      data: { hospitalId: hid, userId: s.sub, action: "UPDATE_ADDON", meta: { id: params.id } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const r = await prisma.addonItem.deleteMany({ where: { id: params.id, hospitalId: hid } });
    if (r.count === 0) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    await prisma.auditLog.create({
      data: { hospitalId: hid, userId: s.sub, action: "DELETE_ADDON", meta: { id: params.id } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}



