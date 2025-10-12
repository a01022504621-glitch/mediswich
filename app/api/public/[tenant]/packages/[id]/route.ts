// app/api/public/[tenant]/packages/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** ---------- 유틸 공통 ---------- */
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
    return groups.map(
      (g: any, i: number) =>
        [String(g?.id ?? g?.key ?? g?.label ?? `G${i + 1}`), g] as [string, any],
    );
  }
  if (typeof groups === "object") return Object.entries(groups);
  return [];
}

/** 깊은 탐색으로 숫자 후보 찾기 */
function deepPickNumber(o: any, keyRegex: RegExp): number {
  try {
    const seen = new Set<any>();
    const stack = [o];
    let best = 0;
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
      seen.add(cur);
      for (const [k, v] of Object.entries(cur)) {
        if (typeof v === "number" && keyRegex.test(k) && Number.isFinite(v) && v > 0) {
          best = Math.max(best, v);
        } else if (v && typeof v === "object") {
          stack.push(v);
        }
      }
    }
    return best;
  } catch {
    return 0;
  }
}

/** 날짜 유틸 */
const pad = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function normDateLike(v: any): string | null {
  if (!v && v !== 0) return null;
  try {
    if (v instanceof Date && !isNaN(v.getTime())) return toYMD(v);
    if (typeof v === "number") return toYMD(new Date(v));
    if (typeof v === "string") {
      const s = v.trim();
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      const d = new Date(s);
      if (!isNaN(d.getTime())) return toYMD(d);
    }
  } catch {}
  return null;
}
function first<T>(...vals: T[]) {
  return vals.find((x) => x != null && x !== "" && x !== false) ?? null;
}

/** ---------- 정규화 레이어(응답 전용) ---------- */
function normalizeTagsForRead(raw: any) {
  if (!raw || typeof raw !== "object") return {};
  const tags = { ...raw };
  const originalGroups = tags.groups;
  const map: Record<string, any> = {};

  for (const [k0, g0] of groupEntries(originalGroups)) {
    const k = String(k0);
    const g = g0 && typeof g0 === "object" ? { ...g0 } : g0 ?? {};
    const vals = toArr(g);
    if (Array.isArray(vals) && vals.length > 0) g.values = vals;
    const cc =
      Number(g?.chooseCount) ||
      Number(g?.choose) ||
      Number(g?.pick) ||
      Number(g?.minPick) ||
      Number(g?.min) ||
      0;
    if (!Number.isFinite(g.chooseCount) || g.chooseCount == null) {
      g.chooseCount = Math.max(0, cc);
      if (!looksBasicKey(k) && g.chooseCount === 0 && (g.values?.length ?? 0) > 0) g.chooseCount = 1;
    }
    map[k] = g;
  }

  const foundBasicKey = Object.keys(map).find((kk) => looksBasicKey(kk));
  if (foundBasicKey && !("basic" in map)) map.basic = map[foundBasicKey];

  return { ...tags, groups: map };
}

function countFromTags(tags: any) {
  let basic = 0, optional = 0;
  if (!tags) return { basic, optional };

  try {
    const entries = groupEntries(tags.groups);
    const basicEntry = entries.find(([k, g]) => looksBasicKey(k) || g?.basic === true || g?.type === "BASIC");
    if (basicEntry) {
      const [, g] = basicEntry;
      const len = Math.max(toArr(g).length, toArr(g?.values).length);
      basic = Math.max(basic, len);
    }
    basic = Math.max(basic, toArr(tags.basicItems).length, toArr(tags.basic).length);
    if (Array.isArray(tags.items)) {
      const b = tags.items.filter((x: any) => x?.basic === true || x?.type === "BASIC").length;
      basic = Math.max(basic, b);
    }
    if (!basic) basic = Math.max(deepPickNumber(tags, /(basic|base|기본).*(count|num|개|수)/i), Number(tags.basicCount || 0));
  } catch {}

  try {
    const entries = groupEntries(tags.groups);
    let opt = 0;
    for (const [k, g] of entries) {
      if (looksBasicKey(k) || g?.basic === true || g?.type === "BASIC") continue;
      const cc =
        Number(g?.chooseCount) ||
        Number(g?.choose) ||
        Number(g?.pick) ||
        Number(g?.minPick) ||
        Number(g?.min) ||
        0;
      const len = Math.max(toArr(g).length, toArr(g?.values).length);
      if (Number.isFinite(cc) && cc > 0) opt += cc;
      else if (len > 0) opt += 1;
    }
    optional = Math.max(optional, opt);
  } catch {}

  return { basic, optional };
}

/** 구독형 파생 */
function deriveBilling(tags: any, oneTimePrice: number | null) {
  try {
    const sub = tags?.subscription ?? tags?.billing ?? {};
    const enabled =
      sub?.enabled === true ||
      String(sub?.type || "").toLowerCase() === "subscription" ||
      !!sub?.period;

    if (!enabled) return { type: "one_time" as const, oneTimePrice: oneTimePrice ?? null };

    const period: string = String(sub?.period || sub?.interval || "monthly").toLowerCase();
    const price: number | null = Number(sub?.price) || Number(sub?.amount) || null;
    const trialDays: number | null = Number(sub?.trialDays) || null;
    const intervalCount: number | null = Number(sub?.intervalCount) || Number(sub?.count) || null;

    return { type: "subscription" as const, oneTimePrice: oneTimePrice ?? null, subscription: { price, period, intervalCount, trialDays } };
  } catch {
    return { type: "one_time" as const, oneTimePrice: oneTimePrice ?? null };
  }
}

/** 기간 파생 */
function derivePeriod(p: { startDate?: Date | null; endDate?: Date | null; tags?: any }) {
  const t = p.tags || {};
  const from = normDateLike(
    first(
      p.startDate,
      t.startDate, t.start, t.from,
      t.period?.from, t.dates?.from, t.valid?.from,
      t.dateFrom, t.periodFrom
    )
  );
  const to = normDateLike(
    first(
      p.endDate,
      t.endDate, t.end,
      t.period?.to, t.dates?.to, t.valid?.to,
      t.dateTo, t.periodTo
    )
  );
  const tagsWithPeriod =
    from || to
      ? { ...(t || {}), period: { ...(t?.period || {}), from, to } }
      : t;

  return { from, to, tagsWithPeriod };
}

/** ---------- Handler ---------- */
export async function GET(_req: NextRequest, { params }: { params: { tenant: string; id: string } }) {
  try {
    const hospital = await prisma.hospital.findUnique({
      where: { slug: params.tenant },
      select: { id: true },
    });
    if (!hospital) return NextResponse.json({ ok: false, error: "Invalid tenant" }, { status: 404 });

    const p = await prisma.package.findFirst({
      where: { id: params.id, hospitalId: hospital.id, visible: true },
      select: {
        id: true,
        title: true,
        summary: true,
        price: true,
        category: true,
        tags: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const period = derivePeriod(p);
    const tagsNormalized = normalizeTagsForRead(period.tagsWithPeriod);
    const { basic, optional } = countFromTags(tagsNormalized);
    const billing = deriveBilling(tagsNormalized, p.price);

    return NextResponse.json({
      ok: true,
      package: {
        id: p.id,
        title: p.title,
        summary: p.summary,
        price: p.price,
        category: p.category,
        tags: tagsNormalized,
        basicCount: basic,
        optionalCount: optional,
        billing,
        // 기간(호환 키 포함)
        startDate: period.from,
        endDate: period.to,
        periodFrom: period.from,
        periodTo: period.to,
        dateFrom: period.from,
        dateTo: period.to,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

