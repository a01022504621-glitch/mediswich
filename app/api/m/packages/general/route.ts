// app/api/m/packages/general/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";
import { PackageCategory } from "@prisma/client";

/** ───────── 공통 ───────── */
async function hidFromSession() {
  const s = await requireSession();
  const hid = String((s as any).hid || (s as any).hospitalId || "");
  if (!hid) throw new Error("No hospital in session");
  return hid;
}
const CAT: PackageCategory = PackageCategory.GENERAL;

type LegacyLike = {
  id?: string;
  name?: string;
  price?: number | null;
  from?: string | null;
  to?: string | null;
  showInBooking?: boolean;
  groups?: any;
  groupOrder?: any;
  groupMeta?: any;
  addons?: any;
  billing?: any;
  title?: string;
  visible?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  tags?: any;
};

function toDateOrNull(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(+d) ? d : null;
}

function normalizeToDb(p: LegacyLike) {
  const title = (p.title ?? p.name ?? "").toString().trim() || "이름 없는 패키지";

  const visible =
    typeof p.visible === "boolean"
      ? p.visible
      : typeof p.showInBooking === "boolean"
      ? !!p.showInBooking
      : true;

  const startDate = toDateOrNull(p.startDate ?? p.from ?? null);
  const endDate = toDateOrNull(p.endDate ?? p.to ?? null);

  const baseTags = typeof p.tags === "object" && p.tags ? { ...p.tags } : {};
  const legacyBilling = p.billing ?? baseTags.billing ?? null;

  const priceNum =
    typeof p.price === "number"
      ? p.price
      : typeof legacyBilling?.price === "number"
      ? legacyBilling.price
      : (typeof baseTags.price === "number" ? baseTags.price : null);

  const nextTags = {
    ...baseTags,
    groups: baseTags.groups ?? p.groups ?? {},
    groupOrder: baseTags.groupOrder ?? p.groupOrder ?? [],
    groupMeta: baseTags.groupMeta ?? p.groupMeta ?? {},
    addons: baseTags.addons ?? p.addons ?? [],
    billing: ((): any => {
      if (!legacyBilling && priceNum == null) return baseTags.billing ?? null;
      return { ...(legacyBilling || {}), price: priceNum ?? null };
    })(),
  };

  return {
    title,
    visible,
    startDate,
    endDate,
    tags: nextTags,
    category: CAT,
    price: typeof priceNum === "number" ? priceNum : null,
  };
}

function rowToLegacy(item: any) {
  const t = item?.tags ?? {};
  const billing = t.billing ?? null;
  const price =
    typeof billing?.price === "number"
      ? billing.price
      : typeof item?.price === "number"
      ? item.price
      : null;

  return {
    id: item.id,
    name: item.title,
    price,
    showInBooking: !!item.visible,
    from: item.startDate ?? null,
    to: item.endDate ?? null,
    groups: t.groups ?? {},
    groupOrder: t.groupOrder ?? [],
    groupMeta: t.groupMeta ?? {},
    addons: t.addons ?? [],
    billing,
  };
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** ───────── GET ───────── */
export async function GET(_req: NextRequest) {
  try {
    const hid = await hidFromSession();
    const rows = await prisma.package.findMany({
      where: { hospitalId: hid, category: CAT },
      orderBy: { createdAt: "desc" },
    });
    return json({ ok: true, items: rows.map(rowToLegacy) });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 400);
  }
}

/** ───────── POST(단일/배열) ───────── */
export async function POST(req: NextRequest) {
  try {
    const hid = await hidFromSession();
    const body = (await req.json().catch(() => ({}))) as any;

    if (Array.isArray(body?.items)) {
      const items: LegacyLike[] = body.items;
      if (!items.length) return json({ ok: false, error: "등록할 패키지 목록이 비어 있습니다." }, 400);

      const replaceAll = String(req.nextUrl.searchParams.get("replaceAll") || body.replaceAll || "") === "true";

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.package.findMany({
          where: { hospitalId: hid, category: CAT },
          select: { id: true },
        });
        const existingIds = new Set(existing.map((x) => x.id));

        for (const p of items) {
          const data = normalizeToDb(p);
          const id = (p.id || "").trim();
          if (id && existingIds.has(id)) {
            await tx.package.update({ where: { id }, data });
          } else if (id) {
            await tx.package.create({ data: { id, hospitalId: hid, ...data } });
          } else {
            await tx.package.create({ data: { hospitalId: hid, ...data } });
          }
        }

        if (replaceAll) {
          const incomingIds = new Set(items.map((x) => (x.id || "").trim()).filter(Boolean));
          const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
          for (const id of toRemove) {
            try {
              await tx.package.delete({ where: { id } });
            } catch {
              await tx.package.update({ where: { id }, data: { visible: false } });
            }
          }
        }

        const saved = await tx.package.findMany({
          where: { hospitalId: hid, category: CAT },
          orderBy: { createdAt: "desc" },
        });
        return saved.map(rowToLegacy);
      });

      return json({ ok: true, items: result }, 200);
    }

    const src: LegacyLike = (body?.item as LegacyLike) ?? (body as LegacyLike);
    const data = normalizeToDb(src);
    const id = (src?.id || "").trim();

    let row;
    if (id) {
      const exist = await prisma.package.findFirst({ where: { id, hospitalId: hid, category: CAT } });
      row = exist
        ? await prisma.package.update({ where: { id }, data })
        : await prisma.package.create({ data: { id, hospitalId: hid, ...data } });
    } else {
      row = await prisma.package.create({ data: { hospitalId: hid, ...data } });
    }
    return json({ ok: true, item: rowToLegacy(row) }, id ? 200 : 201);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 400);
  }
}

/** ───────── PUT(부분 업데이트) ───────── */
export async function PUT(req: NextRequest) {
  try {
    const hid = await hidFromSession();
    const body = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<LegacyLike> };
    const id = (body.id || "").trim();
    if (!id) return json({ ok: false, error: "id가 필요합니다." }, 400);

    const target = await prisma.package.findFirst({ where: { id, hospitalId: hid, category: CAT } });
    if (!target) return json({ ok: false, error: "대상이 없거나 스코프 불일치" }, 404);

    const merged: LegacyLike = {
      id,
      title: target.title,
      visible: target.visible,
      startDate: target.startDate as any,
      endDate: target.endDate as any,
      tags: target.tags as any,
      price: target.price,
      ...body.patch,
    };
    const data = normalizeToDb(merged);

    const updated = await prisma.package.update({ where: { id }, data });
    return json({ ok: true, item: rowToLegacy(updated) }, 200);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 400);
  }
}

/** ───────── PATCH(토글 등) ───────── */
export async function PATCH(req: NextRequest) {
  try {
    const hid = await hidFromSession();
    const body = (await req.json().catch(() => ({}))) as { id?: string; visible?: boolean; title?: string; price?: number | null };
    const id = (body.id || "").trim();
    if (!id) return json({ ok: false, error: "id가 필요합니다." }, 400);

    const target = await prisma.package.findFirst({ where: { id, hospitalId: hid, category: CAT } });
    if (!target) return json({ ok: false, error: "대상이 없거나 스코프 불일치" }, 404);

    const data: any = {};
    if (typeof body.visible === "boolean") data.visible = body.visible;
    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.price !== "undefined") data.price = body.price;

    const updated = await prisma.package.update({ where: { id }, data });
    return json({ ok: true, item: rowToLegacy(updated) }, 200);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 400);
  }
}

/** ───────── DELETE: id 있으면 단건, 없으면 전체 와이프 ───────── */
export async function DELETE(req: NextRequest) {
  try {
    const hid = await hidFromSession();
    const url = new URL(req.url);
    const id = (url.searchParams.get("id") || "").trim();

    if (!id) {
      // 전체 와이프
      const rows = await prisma.package.findMany({
        where: { hospitalId: hid, category: CAT },
        select: { id: true },
      });
      let hard = 0, soft = 0;
      for (const r of rows) {
        const ref = await prisma.booking.count({ where: { hospitalId: hid, packageId: r.id } });
        if (ref > 0) {
          await prisma.package.update({ where: { id: r.id }, data: { visible: false } });
          soft++;
        } else {
          try {
            await prisma.package.delete({ where: { id: r.id } });
            hard++;
          } catch {
            await prisma.package.update({ where: { id: r.id }, data: { visible: false } });
            soft++;
          }
        }
      }
      return json({ ok: true, wiped: { hard, soft } }, 200);
    }

    // 단건 삭제
    const target = await prisma.package.findFirst({ where: { id, hospitalId: hid, category: CAT } });
    if (!target) return json({ ok: false, error: "대상이 없거나 스코프 불일치" }, 404);

    const ref = await prisma.booking.count({ where: { hospitalId: hid, packageId: id } });
    if (ref > 0) {
      await prisma.package.update({ where: { id }, data: { visible: false } });
      return json({ ok: true, archived: true, reason: "IN_USE" }, 200);
    }

    await prisma.package.delete({ where: { id } });
    return json({ ok: true, deleted: true }, 200);
  } catch (e: any) {
    try {
      const url = new URL(req.url);
      const id = (url.searchParams.get("id") || "").trim();
      if (id) await prisma.package.update({ where: { id }, data: { visible: false } });
    } catch {}
    return json({ ok: false, error: String(e?.message || e) }, 400);
  }
}





