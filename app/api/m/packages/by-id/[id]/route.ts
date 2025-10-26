export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/m/packages/by-id/[id]/route.ts
 
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { cookies, headers } from "next/headers";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

async function resolveHid(session: any) {
  const ck = cookies(); const hd = headers();
  const c = ck.get("current_hospital_id")?.value || "";
  if (c) return c;
  const s = session?.hid || session?.hospitalId || "";
  if (s) return s;
  const slug = ck.get("r_tenant")?.value || "";
  if (slug) { const t = await resolveTenantHybrid({ slug, host: hd.get("host") || undefined }); if (t?.id) return t.id; }
  const t2 = await resolveTenantHybrid({ host: hd.get("host") || undefined });
  return t2?.id || "";
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = await resolveHid(s);
    if (!hid) return NextResponse.json({ ok: false, error: "hospital_not_selected" }, { status: 400 });

    const row = await prisma.package.findFirst({ where: { id: params.id, hospitalId: hid } });
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = await resolveHid(s);
    if (!hid) return NextResponse.json({ ok: false, error: "hospital_not_selected" }, { status: 400 });

    const id = params.id;
    const exists = await prisma.package.findFirst({ where: { id, hospitalId: hid } });
    if (!exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });

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
    const hid = await resolveHid(s);
    if (!hid) return NextResponse.json({ ok: false, error: "hospital_not_selected" }, { status: 400 });

    const id = params.id;
    const row = await prisma.package.findFirst({ where: { id, hospitalId: hid } });
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });

    await prisma.package.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}


