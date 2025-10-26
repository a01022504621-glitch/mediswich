export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/m/addons/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

type SexIn = "A" | "M" | "F";
type AddonDTO = { id?: string; name: string; sex: SexIn; price: number | null; visible: boolean; clientId: string | null };

const toSexOut = (s: "M" | "F" | null): SexIn => (s === "M" || s === "F" ? s : "A");
const fromSexIn = (s: SexIn): "M" | "F" | null => (s === "A" ? null : s);

/** 목록 조회 */
export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const url = new URL(req.url);
    const clientId = (url.searchParams.get("clientId") || "").trim() || null;

    if (clientId) {
      const items = await prisma.addonItem.findMany({
        where: { hospitalId: hid },
        orderBy: { createdAt: "desc" },
        include: {
          clientOverrides: {
            where: { clientId },
            select: { enabled: true, priceKRW: true },
          },
        },
      });

      const mapped: AddonDTO[] = items.map((r) => {
        const ov = r.clientOverrides[0];
        const price = ov?.priceKRW ?? r.priceKRW ?? null;
        const visible = ov?.enabled ?? r.isActive ?? true;
        return {
          id: r.id,
          name: r.name,
          sex: toSexOut(r.sex),
          price,
          visible,
          clientId,
        };
      });

      return NextResponse.json({ ok: true, items: mapped });
    }

    const baseItems = await prisma.addonItem.findMany({
      where: { hospitalId: hid },
      orderBy: { createdAt: "desc" },
    });

    const mappedBase: AddonDTO[] = baseItems.map((r) => ({
      id: r.id,
      name: r.name,
      sex: toSexOut(r.sex),
      price: r.priceKRW ?? null,
      visible: r.isActive ?? true,
      clientId: null,
    }));

    return NextResponse.json({ ok: true, items: mappedBase });
  } catch (e: any) {
    return NextResponse.json({ ok: false, items: [], error: String(e?.message || e) }, { status: 200 });
  }
}

/** 생성/수정 */
export async function POST(req: NextRequest) {
  try {
    const s = await requireSession();
    const hid = s.hid!;

    const body = (await req.json().catch(() => ({}))) as Partial<AddonDTO>;
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });

    const sexIn: SexIn = (["A", "M", "F"].includes(String(body.sex)) ? (body.sex as SexIn) : "A");
    const price = typeof body.price === "number" ? Math.max(0, Math.trunc(body.price)) : null;
    const visible = typeof body.visible === "boolean" ? body.visible : true;
    const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;

    if (body.id) {
      const base = await prisma.addonItem.findFirst({ where: { id: body.id, hospitalId: hid } });
      if (!base) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

      await prisma.addonItem.update({
        where: { id: base.id },
        data: {
          name,
          sex: fromSexIn(sexIn),
          isActive: visible,
          ...(price != null ? { priceKRW: price } : {}), // null이면 필드 생략
        },
      });

      if (clientId) {
        await prisma.addonItemClient.upsert({
          where: { addonItemId_clientId: { addonItemId: base.id, clientId } },
          update: { enabled: visible, priceKRW: price ?? undefined },
          create: { addonItemId: base.id, clientId, enabled: visible, priceKRW: price ?? undefined },
        });
      }

      await prisma.auditLog.create({
        data: { hospitalId: hid, userId: s.sub ?? null, action: "UPSERT_ADDON", meta: { id: base.id, clientId } },
      });

      return NextResponse.json({ ok: true, id: base.id });
    }

    const created = await prisma.addonItem.create({
      data: {
        hospitalId: hid,
        name,
        sex: fromSexIn(sexIn),
        isActive: visible,
        ...(price != null ? { priceKRW: price } : {}), // 기본값 유지
      },
    });

    if (clientId) {
      await prisma.addonItemClient.upsert({
        where: { addonItemId_clientId: { addonItemId: created.id, clientId } },
        update: { enabled: visible, priceKRW: price ?? undefined },
        create: { addonItemId: created.id, clientId, enabled: visible, priceKRW: price ?? undefined },
      });
    }

    await prisma.auditLog.create({
      data: { hospitalId: hid, userId: s.sub ?? null, action: "CREATE_ADDON", meta: { id: created.id, clientId } },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}

/** 선택 스코프 전체 삭제 */
export async function DELETE(req: NextRequest) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const url = new URL(req.url);
    const clientId = (url.searchParams.get("clientId") || "").trim() || null;

    if (clientId) {
      const targets = await prisma.addonItem.findMany({
        where: { hospitalId: hid, clientOverrides: { some: { clientId } } },
        select: { id: true },
      });
      const ids = targets.map((t) => t.id);
      if (ids.length) {
        await prisma.addonItemClient.deleteMany({ where: { clientId, addonItemId: { in: ids } } });
      }
      await prisma.auditLog.create({
        data: { hospitalId: hid, userId: s.sub ?? null, action: "CLEAR_ADDON_OVERRIDES", meta: { clientId } },
      });
      return NextResponse.json({ ok: true, cleared: ids.length });
    }

    const r = await prisma.addonItem.deleteMany({ where: { hospitalId: hid } });
    await prisma.auditLog.create({
      data: { hospitalId: hid, userId: s.sub ?? null, action: "CLEAR_ADDONS_BASE", meta: { count: r.count } },
    });
    return NextResponse.json({ ok: true, cleared: r.count });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}


