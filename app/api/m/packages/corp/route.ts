// app/api/m/packages/corp/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

/* ──────────────────────────────────────────────────────────────
   태그 정규화(원본 유지)
   ────────────────────────────────────────────────────────────── */
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
  if (Array.isArray(groups))
    return groups.map(
      (g: any, i: number) =>
        [String(g?.id ?? g?.key ?? g?.label ?? `G${i + 1}`), g] as [string, any],
    );
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
      Number(g?.chooseCount) ||
      Number(g?.choose) ||
      Number(g?.pick) ||
      Number(g?.minPick) ||
      Number(g?.min) ||
      0;

    if (Number.isFinite(target.chooseCount))
      chooseCount = Math.max(Number(target.chooseCount || 0), Number(chooseCount || 0));

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
      if (key === k && !/^opt_[A-Za-z]+$/.test(k))
        key = normalizeOptId(k.replace(/[^A-Za-z]/g, "").slice(0, 1) || "A");
    }
    pushInto(key, g0);
  }

  if (Array.isArray(tags.basic) || Array.isArray(tags.basicItems))
    pushInto("basic", { values: toArr(tags.basic).concat(toArr(tags.basicItems)) });

  if (Array.isArray(tags.optionGroups))
    for (let i = 0; i < tags.optionGroups.length; i++) {
      const g = tags.optionGroups[i];
      const id = normalizeOptId(g?.id || g?.key || String.fromCharCode(65 + i));
      pushInto(id, g);
    }

  if (!map.basic) {
    const basicKey = Object.keys(map).find((kk) => looksBasicKey(kk));
    if (basicKey) map.basic = map[basicKey];
  }

  for (const k of Object.keys(map)) {
    const vals = Array.from(
      new Map(toArr(map[k]).map((v: any) => [JSON.stringify(v), v])).values(),
    );
    map[k] = { ...map[k], values: vals };
  }

  const billingLike = tags.subscription ?? tags.billing;
  let billing: any = undefined;
  if (billingLike && typeof billingLike === "object") {
    const type = String(
      billingLike.type || (billingLike.enabled ? "subscription" : "one_time") || "",
    ).toLowerCase();
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

/* ──────────────────────────────────────────────────────────────
   GET: CORP 패키지 목록 (clientId 필터 지원)
   ────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const hid = await hidFromSession();
    const url = new URL(req.url);
    const clientId = (url.searchParams.get("clientId") || "").trim() || null;

    const items = await prisma.package.findMany({
      where: { hospitalId: hid, category: "CORP", ...(clientId ? { clientId } : {}) },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, items: [], error: String(e) }, { status: 200 });
  }
}

/* ──────────────────────────────────────────────────────────────
   POST: 생성/갱신
   ────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const hid = await hidFromSession();

    const body = await req.json().catch(() => ({}));
    const { id, title, price, summary, tags, visible } = body ?? {};

    if (!title || typeof title !== "string") {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 200 });
    }

    // clientId 확정: clientId → clientCode → null
    let clientId: string | null = body?.clientId ?? null;
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
      // 소유권 검증
      const owned = await prisma.client.findFirst({
        where: { id: clientId, hospitalId: hid },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json({ ok: false, error: "Invalid clientId" }, { status: 200 });
      }
    }

    const data: any = {
      hospitalId: hid,
      clientId,
      title: String(title || "").trim(),
      price: typeof price === "number" ? price : null,
      summary: summary ?? null,
      tags: normalizeTagsForWrite(tags && typeof tags === "object" ? tags : {}),
      visible: typeof visible === "boolean" ? visible : true,
      category: "CORP",
    };

    if (id) {
      const exists = await prisma.package.findFirst({ where: { id, hospitalId: hid } });
      if (!exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 200 });

      const row = await prisma.package.update({ where: { id }, data });
      return NextResponse.json({ ok: true, id: row.id });
    }

    // id 없음: (title, clientId) 기준 중복 시 갱신
    const dup = await prisma.package.findFirst({
      where: {
        hospitalId: hid,
        category: "CORP",
        title: data.title,
        ...(clientId ? { clientId } : { clientId: null }),
      },
      select: { id: true },
    });

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

/* ──────────────────────────────────────────────────────────────
   DELETE: 병원 단위 또는 특정 고객사 단위 전체 삭제
   ────────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const hid = await hidFromSession();
    const url = new URL(req.url);
    const clientId = (url.searchParams.get("clientId") || "").trim() || null;

    try {
      const r = await prisma.package.deleteMany({
        where: { hospitalId: hid, category: "CORP", ...(clientId ? { clientId } : {}) },
      });
      return NextResponse.json({ ok: true, deleted: r.count });
    } catch {
      const r = await prisma.package.updateMany({
        where: { hospitalId: hid, category: "CORP", ...(clientId ? { clientId } : {}) },
        data: { visible: false },
      });
      return NextResponse.json({ ok: true, hidden: r.count });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}







