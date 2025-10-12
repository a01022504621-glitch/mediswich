// app/api/m/packages/by-ns/[ns]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";

type Ns = "nhis" | "general" | "corp";
const nsToCategory = (ns: Ns) => (ns === "nhis" ? "NHIS" : ns === "general" ? "GENERAL" : "CORP");

export async function GET(_req: Request, { params }: { params: { ns: Ns } }) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any)?.hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, items: [] }, { status: 401 });

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
    const hospitalId = s.hid ?? (s as any)?.hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const data: any = {
      hospitalId,
      title: String(body.title ?? "").trim(),
      summary: body.summary ?? null,
      price: typeof body.price === "number" ? body.price : null,
      tags: body && typeof body.tags === "object" ? body.tags : {}, // ← 객체만 저장
      visible: typeof body.visible === "boolean" ? body.visible : true,
      category: nsToCategory(params.ns),
    };
    if (!data.title) {
      return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
    }

    if (params.ns === "corp") {
      let clientId: string | null = body.clientId ?? null;
      if (!clientId) {
        const rawCode = body.clientCode ?? body.code ?? body.client_code ?? body.corpCode ?? null;
        const clientCode = rawCode ? String(rawCode).trim() : "";
        if (clientCode) {
          const found = await prisma.client.findFirst({
            where: { hospitalId, code: { equals: clientCode } },
            select: { id: true },
          });
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

