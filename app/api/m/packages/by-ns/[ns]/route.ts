export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

/* ───────── session → hid ───────── */
async function hidFromSession() {
  const s = await requireSession();
  const hid = String((s as any).hid || (s as any).hospitalId || "");
  if (!hid) throw new Error("No hospital in session");
  return hid;
}

/* ───────── ns ↔ category ───────── */
type Ns = "nhis" | "general" | "corp";
const nsToCategory = (ns: Ns) =>
  ns === "nhis" ? "NHIS" : ns === "general" ? "GENERAL" : "CORP";

/* ───────── small utils ───────── */
const BASIC_KEY = /^(basic|base|general|기본|베이직)$/i;
const looksBasicKey = (k: string) => BASIC_KEY.test(k);
const toArr = (v: any): any[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray((v as any).values)) return (v as any).values;
  if (Array.isArray((v as any).items)) return (v as any).items;
  if (Array.isArray((v as any).exams)) return (v as any).exams;
  if (Array.isArray((v as any).list)) return (v as any).list;
  if (Array.isArray((v as any).rows)) return (v as any).rows;
  if (Array.isArray((v as any).data)) return (v as any).data;
  return [];
};
function groupEntries(groups: any): [string, any][] {
  if (!groups) return [];
  if (Array.isArray(groups)) return groups.map((g: any, i: number) => [String(g?.id ?? g?.key ?? g?.label ?? `G${i+1}`), g] as [string, any]);
  if (typeof groups === "object") return Object.entries(groups);
  return [];
}
function normalizeOptId(raw: string): string {
  const s = String(raw || "").trim();
  if (/^opt_[A-Za-z]+$/i.test(s)) return s;
  if (/^[A-Za-z]$/.test(s)) return `opt_${s.toUpperCase()}`;
  return s;
}

/* ───────── tags normalizer (POST 단건용) ───────── */
function normalizeTagsForWrite(raw: any) {
  if (!raw || typeof raw !== "object") return {};
  const tags = { ...raw };
  const map: Record<string, any> = {};

  const pushInto = (key: string, g: any) => {
    const target = map[key] ?? {};
    const nextVals = [...(target.values ?? []), ...toArr(g), ...toArr(g?.values)];

    let chooseCount =
      Number(g?.chooseCount) ||
      Number(g?.choose) ||
      Number(g?.pick) ||
      Number(g?.minPick) ||
      Number(g?.min) ||
      0;

    if (Number.isFinite(target.chooseCount)) {
      chooseCount = Math.max(Number(target.chooseCount || 0), Number(chooseCount || 0));
    }

    const basePayload = { ...target, ...g, values: nextVals };

    if (key === "basic") {
      map[key] = { ...basePayload, chooseCount: 0 };
    } else {
      if (!Number.isFinite(chooseCount) || chooseCount == null) chooseCount = 0;
      if (chooseCount === 0 && nextVals.length > 0) chooseCount = 1;
      map[key] = { ...basePayload, chooseCount };
    }
  };

  for (const [k0, g0] of groupEntries(tags.groups)) {
    const k = String(k0);
    let key: string;
    if (looksBasicKey(k) || g0?.basic === true || g0?.type === "BASIC") key = "basic";
    else {
      key = normalizeOptId(k);
      if (key === k && !/^opt_[A-Za-z]+$/.test(k)) {
        key = normalizeOptId(k.replace(/[^A-Za-z]/g, "").slice(0, 1) || "A");
      }
    }
    pushInto(key, g0);
  }

  if (Array.isArray(tags.basic) || Array.isArray(tags.basicItems)) {
    pushInto("basic", { values: toArr(tags.basic).concat(toArr(tags.basicItems)) });
  }
  if (Array.isArray(tags.optionGroups)) {
    for (let i = 0; i < tags.optionGroups.length; i++) {
      const g = tags.optionGroups[i];
      const id = normalizeOptId(g?.id || g?.key || String.fromCharCode(65 + i));
      pushInto(id, g);
    }
  }
  if (!map.basic) {
    const basicKey = Object.keys(map).find((kk) => looksBasicKey(kk));
    if (basicKey) map.basic = map[basicKey];
  }

  for (const k of Object.keys(map)) {
    const vals = Array.from(new Map(toArr(map[k]).map((v: any) => [JSON.stringify(v), v])).values());
    map[k] = { ...map[k], values: vals };
  }

  const billingLike = tags.subscription ?? tags.billing;
  let billing: any = undefined;
  if (billingLike && typeof billingLike === "object") {
    const type = String(billingLike.type || (billingLike.enabled ? "subscription" : "one_time") || "").toLowerCase();
    billing = {
      type: type === "subscription" ? "subscription" : "one_time",
      enabled: type === "subscription" || !!billingLike.enabled,
      price: Number(billingLike.price ?? billingLike.amount) || null,
      period: String(billingLike.period ?? billingLike.interval ?? "").toLowerCase() || undefined,
      intervalCount: Number(billingLike.intervalCount ?? billingLike.count) || undefined,
      trialDays: Number(billingLike.trialDays) || undefined,
    };
  }

  const next = { ...tags, groups: map };
  if (billing) next.billing = billing;
  return next;
}

/* ───────── DraftPackage → DB write payload (PUT 일괄용) ───────── */
function draftToWritePayload(item: any, category: "NHIS" | "GENERAL" | "CORP") {
  const idFromClient = String(item?.id || "").trim() || undefined; // 클라 식별자
  const title = String(item?.name || "").trim();
  const price =
    typeof item?.price === "number"
      ? item.price
      : Number.isFinite(Number(item?.price))
      ? Number(item.price)
      : null;
  const visible = !!item?.showInBooking;

  let order: string[] =
    Array.isArray(item?.groupOrder) ? item.groupOrder : Object.keys(item?.groups || {});
  let groupsIn: Record<string, any[]> = item?.groups || {};
  if (category === "NHIS" && Array.isArray(item?.base)) {
    groupsIn = { base: item.base };
    order = ["base"];
  }

  const groupMeta = item?.groupMeta || {};
  const groups: Record<string, any> = {};
  for (const gid of order) {
    const rows = Array.isArray(groupsIn[gid]) ? groupsIn[gid] : [];
    const values = rows.map((r: any) => ({
      id: String(r?.examId || ""),
      name: String(r?.name || ""),
      sex: (r?.sex as any) || "A",
      memo: String(r?.memo || ""),
      code: String(r?.code || ""),
    }));
    const meta = groupMeta[gid] || {};
    const label = String(meta?.label || (gid === "base" ? "기본검사" : gid)).trim();
    const chooseCount =
      typeof meta?.chooseCount === "number"
        ? Math.max(0, Math.floor(meta.chooseCount))
        : gid === "base"
        ? 0
        : values.length > 0
        ? 1
        : 0;

    const key = gid === "base" ? "basic" : normalizeOptId(gid);
    groups[key] = { id: key, label, chooseCount, values };
  }

  const addons = Array.isArray(item?.addons) ? item.addons : [];
  const from = item?.from ? String(item.from) : null;
  const to = item?.to ? String(item.to) : null;

  const tags = {
    groups,
    groupOrder: order.map((g: string) => (g === "base" ? "basic" : normalizeOptId(g))),
    addons,
    period: { from, to },
    ...(category === "CORP" && item?.billing ? { billing: item.billing } : {}),
  };

  const data: any = {
    title,
    price,
    summary: null,
    tags,
    visible,
    category,
    startDate: from ? new Date(from) : null,
    endDate: to ? new Date(to) : null,
    ...(category === "CORP" ? { clientId: item?.clientId ?? null } : {}),
  };

  // 증식 방지 키: 최초 저장 시 클라 랜덤 id를 idempotencyKey에 보관
  if (idFromClient) data.idempotencyKey = idFromClient;
  return { idFromClient, data };
}

/* ───────── GET: 목록 ───────── */
export async function GET(_req: NextRequest, { params }: { params: { ns: Ns } }) {
  try {
    const hid = await hidFromSession();
    const category = nsToCategory(params.ns);

    const items = await prisma.package.findMany({
      where: { hospitalId: hid, category },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        price: true,
        tags: true,
        visible: true,
        category: true,
        clientId: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        idempotencyKey: true,
      },
    });

    return NextResponse.json({ ok: true, items }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, items: [], error: String(e) }, { status: 200 });
  }
}

/* ───────── PUT: 일괄 치환(업서트 + 누락 정리) ───────── */
export async function PUT(req: NextRequest, { params }: { params: { ns: Ns } }) {
  try {
    const hid = await hidFromSession();
    const category = nsToCategory(params.ns);
    const body = (await req.json().catch(() => ({}))) as any;
    const rawItems: any[] = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      // 비우기 요청 → 전체 삭제(불가 시 숨김)
      try {
        const dr = await prisma.package.deleteMany({ where: { hospitalId: hid, category } });
        return NextResponse.json({ ok: true, created: 0, updated: 0, deleted: dr.count });
      } catch {
        const ur = await prisma.package.updateMany({
          where: { hospitalId: hid, category },
          data: { visible: false },
        });
        return NextResponse.json({ ok: true, created: 0, updated: 0, hidden: ur.count });
      }
    }

    // CORP: 단일 clientId 묶음 여부
    const clientIdForCorp =
      category === "CORP"
        ? (() => {
            const ids = new Set(
              rawItems
                .map((x: any) => (x?.clientId ?? null) as string | null)
                .filter((v) => v != null),
            );
            return ids.size === 1 ? Array.from(ids)[0]! : null;
          })()
        : null;

    const result = await prisma.$transaction(async (tx) => {
      // 현재 세트
      const current = await tx.package.findMany({
        where: {
          hospitalId: hid,
          category,
          ...(category === "CORP" && clientIdForCorp ? { clientId: clientIdForCorp } : {}),
        },
        select: { id: true, idempotencyKey: true, title: true, clientId: true },
      });
      const byId = new Map(current.map((r) => [r.id, r.id]));
      const byIdemp = new Map<string, string>();
      for (const r of current) if (r.idempotencyKey) byIdemp.set(r.idempotencyKey, r.id);

      let created = 0;
      let updated = 0;
      const keptIds: string[] = [];

      for (const item of rawItems) {
        const { idFromClient, data } = draftToWritePayload(item, category as any);

        // CORP: clientId 단일화(없으면 null)
        if (category === "CORP") {
          data.clientId = data.clientId ?? clientIdForCorp ?? null;
        }

        const idCandidate = String(item?.id || "").trim();
        const byIdHit = idCandidate && byId.get(idCandidate);
        const byIdempHit = data.idempotencyKey ? byIdemp.get(String(data.idempotencyKey)) : undefined;

        if (byIdHit) {
          const row = await tx.package.update({
            where: { id: byIdHit },
            data: {
              title: data.title,
              price: data.price,
              summary: data.summary ?? null,
              tags: data.tags,
              visible: data.visible,
              startDate: data.startDate,
              endDate: data.endDate,
              idempotencyKey: data.idempotencyKey ?? undefined,
              ...(category === "CORP" ? { clientId: data.clientId } : {}),
            },
            select: { id: true },
          });
          keptIds.push(row.id);
          updated++;
        } else if (byIdempHit) {
          const row = await tx.package.update({
            where: { id: byIdempHit },
            data: {
              title: data.title,
              price: data.price,
              summary: data.summary ?? null,
              tags: data.tags,
              visible: data.visible,
              startDate: data.startDate,
              endDate: data.endDate,
              ...(category === "CORP" ? { clientId: data.clientId } : {}),
            },
            select: { id: true },
          });
          keptIds.push(row.id);
          updated++;
        } else {
          const row = await tx.package.create({
            data: {
              hospitalId: hid,
              category,
              title: data.title,
              price: data.price,
              summary: data.summary ?? null,
              tags: data.tags,
              visible: data.visible,
              startDate: data.startDate,
              endDate: data.endDate,
              idempotencyKey: data.idempotencyKey,
              ...(category === "CORP" ? { clientId: data.clientId ?? null } : {}),
            },
            select: { id: true },
          });
          keptIds.push(row.id);
          created++;
        }
      }

      // 누락분 정리(이번 업서트 범위 내에서만)
      const removable = await tx.package.findMany({
        where: {
          hospitalId: hid,
          category,
          ...(category === "CORP" && clientIdForCorp ? { clientId: clientIdForCorp } : {}),
          id: { notIn: keptIds.length ? keptIds : ["__none__"] },
        },
        select: { id: true },
      });
      let deleted = 0;
      let hidden = 0;
      if (removable.length) {
        try {
          const dr = await tx.package.deleteMany({ where: { id: { in: removable.map((r) => r.id) } } });
          deleted = dr.count;
        } catch {
          const ur = await tx.package.updateMany({
            where: { id: { in: removable.map((r) => r.id) } },
            data: { visible: false },
          });
          hidden = ur.count;
        }
      }

      return { created, updated, deleted, hidden };
    });

    return NextResponse.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

/* ───────── POST: 단일 생성/갱신 ───────── */
export async function POST(req: NextRequest, ctx: { params: { ns: Ns } }) {
  const { params } = ctx;
  try {
    const hid = await hidFromSession();
    const category = nsToCategory(params.ns);
    const body = (await req.json().catch(() => ({}))) as any;

    const { id, title, price, summary, tags, visible, idempotencyKey } = body ?? {};
    if (!title || typeof title !== "string") {
      return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
    }

    // CORP: clientId/clientCode
    let clientId: string | null = null;
    if (category === "CORP") {
      clientId = body?.clientId ?? null;
      if (!clientId) {
        const rawCode =
          body?.clientCode ?? body?.code ?? body?.client_code ?? body?.corpCode ?? null;
        const clientCode = rawCode ? String(rawCode).trim() : "";
        if (clientCode) {
          const found = await prisma.client.findFirst({
            where: { hospitalId: hid, code: { equals: clientCode } },
            select: { id: true },
          });
          clientId = found?.id ?? null;
        }
      }
      if (clientId) {
        const owned = await prisma.client.findFirst({
          where: { id: clientId, hospitalId: hid },
          select: { id: true },
        });
        if (!owned) return NextResponse.json({ ok: false, error: "Invalid clientId" }, { status: 200 });
      }
    }

    const data: any = {
      hospitalId: hid,
      title: String(title || "").trim(),
      price: typeof price === "number" ? price : Number.isFinite(Number(price)) ? Number(price) : null,
      summary: summary ?? null,
      tags: normalizeTagsForWrite(tags && typeof tags === "object" ? tags : {}),
      visible: typeof visible === "boolean" ? visible : true,
      category,
      ...(category === "CORP" ? { clientId } : {}),
      ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey) } : {}),
    };

    if (id) {
      const exists = await prisma.package.findFirst({ where: { id, hospitalId: hid, category } });
      if (!exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });
      const row = await prisma.package.update({ where: { id }, data });
      return NextResponse.json({ ok: true, id: row.id, updated: true });
    }

    if (data.idempotencyKey) {
      const dupByKey = await prisma.package.findFirst({
        where: { hospitalId: hid, category, idempotencyKey: data.idempotencyKey },
        select: { id: true },
      });
      if (dupByKey) {
        const row = await prisma.package.update({ where: { id: dupByKey.id }, data });
        return NextResponse.json({ ok: true, id: row.id, updated: true });
      }
    }

    const dupWhere: any = {
      hospitalId: hid,
      category,
      title: data.title,
      ...(category === "CORP" ? { clientId: clientId ?? null } : {}),
    };
    const dup = await prisma.package.findFirst({ where: dupWhere, select: { id: true } });
    if (dup) {
      const row = await prisma.package.update({ where: { id: dup.id }, data });
      return NextResponse.json({ ok: true, id: row.id, updated: true });
    }

    const row = await prisma.package.create({ data });
    return NextResponse.json({ ok: true, id: row.id, created: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

/* ───────── DELETE: 범위 삭제(불가 시 숨김) ───────── */
export async function DELETE(req: NextRequest, { params }: { params: { ns: Ns } }) {
  try {
    const hid = await hidFromSession();
    const category = nsToCategory(params.ns);
    const url = new URL(req.url);
    const clientId =
      category === "CORP" ? (url.searchParams.get("clientId") || "").trim() || null : null;

    try {
      const r = await prisma.package.deleteMany({
        where: { hospitalId: hid, category, ...(clientId ? { clientId } : {}) },
      });
      return NextResponse.json({ ok: true, deleted: r.count });
    } catch {
      const r = await prisma.package.updateMany({
        where: { hospitalId: hid, category, ...(clientId ? { clientId } : {}) },
        data: { visible: false },
      });
      return NextResponse.json({ ok: true, hidden: r.count });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}


