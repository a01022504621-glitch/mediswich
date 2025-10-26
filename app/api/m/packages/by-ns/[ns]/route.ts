export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/m/packages/by-ns/[ns]/route.ts
 
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { cookies, headers } from "next/headers";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

type Ns = "nhis" | "general" | "corp";
const nsToCategory = (ns: Ns) => (ns === "nhis" ? "NHIS" : ns === "general" ? "GENERAL" : "CORP");

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

export async function GET(_req: Request, { params }: { params: { ns: Ns } }) {
  try {
    const s = await requireSession();
    const hospitalId = await resolveHid(s);
    if (!hospitalId) return NextResponse.json({ ok: false, items: [], error: "hospital_not_selected" }, { status: 400 });

    const category = nsToCategory(params.ns);
    const items = await prisma.package.findMany({
      where: { hospitalId, category },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, summary: true, price: true, tags: true, visible: true, category: true, clientId: true },
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, items: [], error: String(e) }, { status: 200 });
  }
}

export async function POST(req: Request, { params }: { params: { ns: Ns } }) {
  try {
    const s = await requireSession();
    const hospitalId = await resolveHid(s);
    if (!hospitalId) return NextResponse.json({ ok: false, error: "hospital_not_selected" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    const data: any = {
      hospitalId,
      title: String(body.title ?? "").trim(),
      summary: body.summary ?? null,
      price: typeof body.price === "number" ? body.price : null,
      tags: body && typeof body.tags === "object" ? body.tags : {},
      visible: typeof body.visible === "boolean" ? body.visible : true,
      category: nsToCategory(params.ns),
    };
    if (!data.title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });

    if (params.ns === "corp") {
      let clientId: string | null = body.clientId ?? null;
      if (!clientId) {
        const rawCode = body.clientCode ?? body.code ?? body.client_code ?? body.corpCode ?? null;
        const clientCode = rawCode ? String(rawCode).trim() : "";
        if (clientCode) {
          const found = await prisma.client.findFirst({ where: { hospitalId, code: { equals: clientCode } }, select: { id: true } });
          clientId = found?.id ?? null;
        }
      }
      data.clientId = clientId;
    }

    const created = await prisma.package.create({ data });
    return NextResponse.json({ ok: true, item: created });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}


