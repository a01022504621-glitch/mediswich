// app/api/m/packages/corp/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";

/* 유틸(일치) */
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
  if (Array.isArray(groups)) {
    return groups.map((g: any, i: number) => [String(g?.id ?? g?.key ?? g?.label ?? `G${i + 1}`), g] as [string, any]);
  }
  if (typeof groups === "object") return Object.entries(groups);
  return [];
}
function normalizeOptId(raw: string): string {
  const s = String(raw || "").trim();
  if (/^opt_[A-Za-z]+$/i.test(s)) return s;
  if (/^[A-Za-z]$/.test(s)) return `opt_${s.toUpperCase()}`;
  return s;
}
function normalizeTagsForWrite(raw: any) {
  if (!raw || typeof raw !== "object") return {};
  const tags = { ...raw };
  const map: Record<string, any> = {};
  const pushInto = (key: string, g: any) => {
    const target = map[key] ?? {};
    const nextVals = [...(target.values ?? []), ...toArr(g), ...toArr(g?.values)];
    let chooseCount =
      Number(g?.chooseCount) || Number(g?.choose) || Number(g?.pick) || Number(g?.minPick) || Number(g?.min) || 0;
    if (Number.isFinite(target.chooseCount)) chooseCount = Math.max(Number(target.chooseCount || 0), Number(chooseCount || 0));
    const basePayload = { ...target, ...g, values: nextVals };
    if (key === "basic") {
      chooseCount = 0;
      map[key] = { ...basePayload, chooseCount };
    } else {
      if (!Number.isFinite(chooseCount) || chooseCount == null) chooseCount = 0;
      if (chooseCount === 0 && nextVals.length > 0) chooseCount = 1;
      map[key] = { ...basePayload, chooseCount };
    }
  };
  for (const [k0, g0] of groupEntries(tags.groups)) {
    const k = String(k0);
    let key = k;
    if (looksBasicKey(k) || g0?.basic === true || g0?.type === "BASIC") key = "basic";
    else {
      key = normalizeOptId(k);
      if (key === k && !/^opt_[A-Za-z]+$/.test(k)) key = normalizeOptId(k.replace(/[^A-Za-z]/g, "").slice(0, 1) || "A");
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

/* ===================== Handlers ===================== */
export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const url = new URL(req.url);
    const clientId = (url.searchParams.get("clientId") || "").trim() || null;
    const items = await prisma.package.findMany({
      where: {
        hospitalId: s.hid ?? (s as any).hospitalId,
        category: "CORP",
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, items: [], error: String(e) }, { status: 200 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const s = await requireSession();
    const body = await req.json();
    const { id, title, price, summary, tags, visible, clientId } = body || {};
    if (!title || typeof title !== "string") {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 200 });
    }
    let validClientId: string | null = clientId || null;
    if (validClientId) {
      const owned = await prisma.client.findFirst({
        where: { id: validClientId, hospitalId: s.hid ?? (s as any).hospitalId },
        select: { id: true },
      });
      if (!owned) return NextResponse.json({ ok: false, error: "Invalid clientId" }, { status: 200 });
    }
    const tagsNormalized = normalizeTagsForWrite(tags && typeof tags === "object" ? tags : {});
    const data: any = {
      hospitalId: s.hid ?? (s as any).hospitalId,
      title: String(title || "").trim(),
      price: typeof price === "number" ? price : null,
      summary: summary ?? null,
      tags: tagsNormalized,
      visible: typeof visible === "boolean" ? visible : true,
      category: "CORP",
      clientId: validClientId,
    };
    if (id) {
      const exists = await prisma.package.findUnique({ where: { id } });
      if (!exists || exists.hospitalId !== (s.hid ?? (s as any).hospitalId)) {
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });
      }
      const row = await prisma.package.update({ where: { id }, data });
      return NextResponse.json({ ok: true, id: row.id });
    } else {
      const row = await prisma.package.create({ data });
      return NextResponse.json({ ok: true, id: row.id });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const s = await requireSession();
    const url = new URL(req.url);
    const clientId = (url.searchParams.get("clientId") || "").trim() || null;
    const r = await prisma.package.deleteMany({
      where: {
        hospitalId: s.hid ?? (s as any).hospitalId,
        category: "CORP",
        ...(clientId ? { clientId } : {}),
      },
    });
    return NextResponse.json({ ok: true, count: r.count });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}



