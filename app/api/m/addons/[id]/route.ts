// app/api/m/addons/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

type SexIn = "A" | "M" | "F";

const toSexOut = (s: "M" | "F" | null): SexIn => (s === "M" || s === "F" ? s : "A");
const fromSexIn = (s: SexIn): "M" | "F" | null => (s === "A" ? null : s);
const normCode = (c: any) => {
  const v = typeof c === "string" ? c.trim() : "";
  return v.length ? v : null;
};

async function assertOwned(id: string, hid: string) {
  const row = await prisma.addonItem.findUnique({ where: { id } });
  if (!row || row.hospitalId !== hid) throw new Error("NOT_FOUND");
  return row;
}

/** 단건 조회(+ 선택적 clientId 오버라이드 반영) */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const url = new URL(req.url);
    const clientId = (url.searchParams.get("clientId") || "").trim() || null;

    const base = await prisma.addonItem.findFirst({
      where: { id: params.id, hospitalId: hid },
      include: clientId
        ? {
            clientOverrides: {
              where: { clientId },
              select: { enabled: true, priceKRW: true },
            },
          }
        : undefined,
    });
    if (!base) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const ov = (base as any).clientOverrides?.[0];
    const price = ov?.priceKRW ?? base.priceKRW ?? null;
    const visible = ov?.enabled ?? base.isActive ?? true;

    return NextResponse.json({
      ok: true,
      item: {
        id: base.id,
        name: base.name,
        sex: toSexOut(base.sex),
        code: base.code ?? null,
        price,
        visible,
        clientId,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}

/** 단건 수정(PATCH) — 코드/성별/가격/노출 + 선택적 클라이언트 오버라이드 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const id = params.id;

    const base = await assertOwned(id, hid);

    const body = (await req.json().catch(() => ({}))) as Partial<{
      name: string;
      sex: SexIn;
      code: string | null;
      price: number | null;
      visible: boolean;
      clientId: string | null;
    }>;

    const dataBase: any = {};
    if (typeof body.name === "string") dataBase.name = body.name.trim();
    if (body.sex) dataBase.sex = fromSexIn(body.sex);
    if ("code" in body) dataBase.code = normCode(body.code);
    if (typeof body.visible === "boolean") dataBase.isActive = body.visible;
    if (typeof body.price === "number" && body.price >= 0) dataBase.priceKRW = Math.trunc(body.price);

    if (Object.keys(dataBase).length) {
      await prisma.addonItem.update({ where: { id: base.id }, data: dataBase });
    }

    const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;
    if (clientId) {
      await prisma.addonItemClient.upsert({
        where: { addonItemId_clientId: { addonItemId: base.id, clientId } },
        update: {
          ...(typeof body.visible === "boolean" ? { enabled: body.visible } : {}),
          ...(typeof body.price === "number" ? { priceKRW: Math.trunc(body.price) } : {}),
        },
        create: {
          addonItemId: base.id,
          clientId,
          enabled: typeof body.visible === "boolean" ? body.visible : true,
          priceKRW: typeof body.price === "number" ? Math.trunc(body.price) : undefined,
        },
      });
    }

    await prisma.auditLog.create({
      data: { hospitalId: hid, userId: s.sub ?? null, action: "PATCH_ADDON", meta: { id: base.id, clientId } },
    });

    return NextResponse.json({ ok: true, id: base.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}

/** 단건 삭제 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const id = params.id;

    const exists = await prisma.addonItem.findFirst({ where: { id, hospitalId: hid }, select: { id: true } });
    if (!exists) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    await prisma.addonItem.delete({ where: { id } });

    await prisma.auditLog.create({
      data: { hospitalId: hid, userId: s.sub ?? null, action: "DELETE_ADDON", meta: { id } },
    });

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}



