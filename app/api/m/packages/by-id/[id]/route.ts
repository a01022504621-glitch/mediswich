// app/api/m/packages/by-id/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const row = await prisma.package.findUnique({ where: { id: params.id } });
    if (!row || row.hospitalId !== (s.hid ?? (s as any).hospitalId)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const id = params.id;
    const exists = await prisma.package.findUnique({ where: { id } });
    if (!exists || exists.hospitalId !== (s.hid ?? (s as any).hospitalId)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });
    }
    const body = await req.json();
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
    const s = await requireSession();
    const id = params.id;
    const row = await prisma.package.findUnique({ where: { id } });
    if (!row || row.hospitalId !== (s.hid ?? (s as any).hospitalId)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });
    }
    await prisma.package.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

