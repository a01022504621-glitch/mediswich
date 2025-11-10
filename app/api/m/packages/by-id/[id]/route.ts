export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// app/api/m/packages/by-id/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

/** 세션에서 hid만 신뢰 */
async function hidFromSession() {
  const s = await requireSession();
  const hid = String((s as any).hid || (s as any).hospitalId || "");
  if (!hid) throw new Error("No hospital in session");
  return hid;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const hid = await hidFromSession();
    const row = await prisma.package.findFirst({ where: { id: params.id, hospitalId: hid } });
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const hid = await hidFromSession();
    const id = params.id;

    const exists = await prisma.package.findFirst({ where: { id, hospitalId: hid } });
    if (!exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });

    const body = await req.json().catch(() => ({}));
    const { title, price, summary, tags, visible, clientId } = body ?? {};
    const data: any = {};
    if (typeof title === "string") data.title = title.trim();
    if (typeof price === "number") data.price = price; else if (price === null) data.price = null;
    if (summary !== undefined) data.summary = summary ?? null;
    if (tags !== undefined) data.tags = tags && typeof tags === "object" ? tags : {};
    if (typeof visible === "boolean") data.visible = visible;
    if (clientId !== undefined) data.clientId = clientId || null;

    const row = await prisma.package.update({ where: { id }, data });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const hid = await hidFromSession();
    const id = params.id;

    const row = await prisma.package.findFirst({ where: { id, hospitalId: hid } });
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });

    await prisma.package.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}



