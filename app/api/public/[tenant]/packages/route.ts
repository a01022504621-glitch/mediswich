// app/api/public/[tenant]/packages/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

const CC_PUBLIC = "public, s-maxage=60, stale-while-revalidate=600";
type JsonObj = Record<string, any>;
const obj = (v: unknown): JsonObj => (v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObj) : {});

/* -------------------- 공통 유틸 -------------------- */
function normalizeCat(v?: string | null) {
  const s = (v || "").toUpperCase();
  return s === "NHIS" || s === "GENERAL" || s === "CORP" ? (s as "NHIS" | "GENERAL" | "CORP") : "NHIS";
}
const BASIC_KEY = /^(basic|base|general|기본|베이직)$/i;
const looksBasicKey = (k: string) => BASIC_KEY.test(k);

const toArr = (v: any): any[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.values)) return v.values;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.options)) return v.options;
  if (Array.isArray(v?.list)) return v.list;
  if (Array.isArray(v?.rows)) return v.rows;
  if (Array.isArray(v?.data)) return v.data;
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

/* ===== 날짜 정규화 ===== */
const pad = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function normDateLike(v: any): string | null {
  if (v == null || v === "") return null;
  try {
    if (v instanceof Date && !isNaN(v.getTime())) return toYMD(v);
    const s = String(v).trim();

    const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

    const m2 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

    const any = s.match(/(\d{4})[.\-/]?(\d{1,2})[.\-/]?(\d{1,2})/);
    if (any) return `${any[1]}-${pad(+any[2])}-${pad(+any[3])}`;

    const d = new Date(s);
    if (!isNaN(d.getTime())) return toYMD(d);
  } catch {}
  return null;
}
function pickDate(...cands: any[]): string | null {
  for (const c of cands) {
    const y = normDateLike(c);
    if (y) return y;
  }
  return null;
}

/** tags.groups 정규화 */
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
      if (!looksBasicKey(k) && g.chooseCount === 0 && (g.values?.length ?? 0) > 0) {
        g.chooseCount = 1;
      }
    }
    map[k] = g;
  }

  const foundBasicKey = Object.keys(map).find((kk) => looksBasicKey(kk));
  if (foundBasicKey && !("basic" in map)) map.basic = map[foundBasicKey];

  return { ...tags, groups: map };
}

/** 성별 정규화 */
const normSex = (x: any): "M" | "F" | null => {
  const s = String(x ?? "").trim().toUpperCase();
  if (["M", "MALE", "남", "남성"].includes(s)) return "M";
  if (["F", "FEMALE", "여", "여성"].includes(s)) return "F";
  return null;
};

/** 목록 응답에도 optionGroups 생성: items[].code 포함 */
function deriveOptionGroupsFromTags(tags: any) {
  const out: Array<{ id: string; label: string; chooseCount: number | null; items: any[] }> = [];
  const groups = tags?.groups || {};
  for (const [key, g] of Object.entries<any>(groups)) {
    if (looksBasicKey(key) || g?.basic === true || g?.type === "BASIC") continue;

    const groupSex = normSex(g?.sex ?? g?.gender ?? g?.sexNormalized);

    const items = toArr(g?.values ?? g?.items ?? g?.options ?? g)
      .map((x: any, idx: number) => {
        const itemSex = normSex(x?.sex ?? x?.gender ?? x?.sexNormalized) ?? groupSex ?? null;
        const code = ((): string => {
          const c = x?.code ?? x?.examCode ?? x?.kcode ?? x?.kCode ?? x?.Code ?? null;
          return c != null ? String(c).trim() : "";
        })();
        return {
          id: String(x?.id ?? x?.code ?? `${key}-${idx + 1}`),
          name: String(x?.name ?? x?.title ?? x ?? "").trim(),
          price:
            typeof x?.price === "number"
              ? x.price
              : typeof x?.priceKRW === "number"
              ? x.priceKRW
              : undefined,
          resource: x?.resource ?? null,
          sex: itemSex,
          sexNormalized: itemSex,
          gender: itemSex,
          code, // ← 핵심
        };
      })
      .filter((x: any) => !!x.name);

    const choose =
      Number(g?.chooseCount) ||
      Number(g?.choose) ||
      Number(g?.pick) ||
      Number(g?.minPick) ||
      Number(g?.min) ||
      0;

    out.push({
      id: String(g?.id ?? key),
      label: String(g?.label ?? key),
      chooseCount: Number.isFinite(choose) && choose > 0 ? choose : null,
      items,
    });
  }
  return out;
}

/** 기본검사 목록 파생 */
function deriveBaseExamsFromTags(tags: any): string[] {
  const groups = tags?.groups || {};
  const entry =
    Object.entries<any>(groups).find(([k, g]) => looksBasicKey(k) || g?.basic === true || g?.type === "BASIC") ?? null;

  if (entry) {
    const [, g] = entry;
    return toArr(g?.values ?? g?.items ?? g?.options ?? g)
      .map((x: any) => String(x?.name ?? x?.title ?? x ?? "").trim())
      .filter(Boolean);
  }
  return toArr(tags?.basicItems ?? tags?.basic ?? []).map((x: any) => String(x?.name ?? x?.title ?? x ?? "").trim());
}

/** 기본/선택 개수 계산 */
function countFromTags(tags: any) {
  let basic = 0,
    optional = 0;

  try {
    const entries = groupEntries(tags?.groups);
    const basicEntry = entries.find(([k, g]) => looksBasicKey(k) || g?.basic === true || g?.type === "BASIC");
    if (basicEntry) {
      const [, g] = basicEntry;
      const len = Math.max(toArr(g).length, toArr(g?.values).length);
      basic = Math.max(basic, len);
    }
    basic = Math.max(basic, toArr(tags?.basicItems).length, toArr(tags?.basic).length);
    if (Array.isArray(tags?.items)) {
      const b = tags.items.filter((x: any) => x?.basic === true || x?.type === "BASIC").length;
      basic = Math.max(basic, b);
    }
    if (!basic) {
      basic = Math.max(deepPickNumber(tags, /(basic|base|기본).*(count|num|개|수)/i), Number(tags?.basicCount || 0));
    }
  } catch {}

  try {
    const entries = groupEntries(tags?.groups);
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

    if (Array.isArray(tags?.optionGroups)) {
      for (const g of tags.optionGroups) {
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
    }

    if (Array.isArray(tags?.options)) opt = Math.max(opt, tags.options.length);

    if (!opt && Array.isArray(tags?.items)) {
      const map: Record<string, 1> = {};
      for (const it of tags.items) {
        const grp = it?.group || it?.opt || it?.option || it?.grp;
        if (!grp || looksBasicKey(String(grp))) continue;
        map[String(grp)] = 1;
      }
      opt = Math.max(opt, Object.keys(map).length);
    }

    if (!opt) {
      opt = Math.max(
        deepPickNumber(tags, /(option|optional|선택).*(count|num|개|수)/i),
        Number(tags?.optionCount || tags?.optionalCount || 0)
      );
    }
    optional = Math.max(optional, opt);
  } catch {}

  return { basic, optional };
}

/** 구독형 판매 파생 (응답 전용) */
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

/* -------------------- Handler -------------------- */
export async function GET(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    const url = new URL(req.url);
    const cat = normalizeCat(url.searchParams.get("cat") || url.searchParams.get("category"));
    const rawCode = (url.searchParams.get("code") || "").trim();
    const code = rawCode ? [rawCode, rawCode.toUpperCase(), rawCode.toLowerCase()] : undefined;
    const take = Math.min(Math.max(Number(url.searchParams.get("take") || 200), 1), 1000);
    const skip = Math.max(Number(url.searchParams.get("skip") || 0), 0);

    const hospital = await prisma.hospital.findUnique({
      where: { slug: params.tenant },
      select: { id: true },
    });
    if (!hospital) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: { "cache-control": CC_PUBLIC } });
    }

    const where: any = { hospitalId: hospital.id, visible: true, category: cat };

    // 기업 패키지
    let client: any = null;
    if (cat === "CORP" && code) {
      client = await prisma.client.findFirst({
        where: { hospitalId: hospital.id, code: { in: code } },
        select: { id: true, name: true, code: true, directUrl: true, startDate: true, endDate: true },
      });
      if (client?.id) where.clientId = client.id;
      else where.client = { code: { in: code } };
    }

    const rows = await prisma.package.findMany({
      where,
      take,
      skip,
      orderBy: [{ createdAt: "desc" }],
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

    const packages = rows.map((p) => {
      const tagsRaw = obj(p.tags);
      const tagsNormalized = normalizeTagsForRead(tagsRaw);

      // 파생 필드들
      const optionGroups = deriveOptionGroupsFromTags(tagsNormalized); // items[].code 포함
      const baseExams = deriveBaseExamsFromTags(tagsNormalized);
      const { basic, optional } = countFromTags(tagsNormalized);
      const billing = deriveBilling(tagsNormalized, p.price);

      const s = pickDate(
        p.startDate,
        tagsRaw.startDate,
        tagsRaw.validFrom,
        tagsRaw.from,
        tagsRaw.period?.from,
        tagsRaw.dates?.from,
        tagsRaw.periodFrom,
        tagsRaw.dateFrom
      );
      const e = pickDate(
        p.endDate,
        tagsRaw.endDate,
        tagsRaw.validTo,
        tagsRaw.to,
        tagsRaw.period?.to,
        tagsRaw.dates?.to,
        tagsRaw.periodTo,
        tagsRaw.dateTo
      );

      const tagsWithPeriod =
        s || e
          ? { ...tagsNormalized, period: { ...(tagsNormalized as any)?.period, from: s, to: e } }
          : tagsNormalized;

      return {
        id: p.id,
        title: p.title,
        summary: p.summary,
        price: p.price,
        category: p.category as "NHIS" | "GENERAL" | "CORP",
        basicCount: basic,
        optionalCount: optional,
        tags: tagsWithPeriod,
        billing,
        startDate: s,
        endDate: e,
        periodFrom: s,
        periodTo: e,
        dateFrom: s,
        dateTo: e,
        // 예약 클라이언트 fallback 대비
        optionGroups,
        basicExams: baseExams,
        baseExams,
      };
    });

    // ETag
    const body = { ok: true, packages, items: packages, client };
    const json = JSON.stringify(body);
    const etag = `"W/${createHash("sha1").update(json).digest("base64")}"`;
    const inm = req.headers.get("if-none-match");
    if (inm && inm === etag) {
      return new NextResponse(null, { status: 304, headers: { "cache-control": CC_PUBLIC, etag } });
    }

    return new NextResponse(json, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": CC_PUBLIC,
        etag,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

