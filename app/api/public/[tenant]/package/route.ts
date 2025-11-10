// app/api/public/[tenant]/package/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

/** -------------------- 작은 유틸 -------------------- */
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
  if (typeof v === "object") return Object.values(v);
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

const normSex = (x: any): "M" | "F" | null => {
  const s = String(x ?? "").trim().toUpperCase();
  if (["M", "MALE", "남", "남성"].includes(s)) return "M";
  if (["F", "FEMALE", "여", "여성"].includes(s)) return "F";
  return null;
};

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

/** tags.groups 정규화 (응답 전용, DB 미변경) */
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

/** optionGroups 파생: 반드시 items[].code, items[].examId 포함 */
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
        const examId =
          (x?.examId && String(x.examId)) ||
          (x?.id && String(x.id)) ||
          null;

        return {
          id: String(x?.id ?? x?.code ?? `${key}-${idx + 1}`),
          name: String(x?.name ?? x?.title ?? x ?? "").trim(),
          price: typeof x?.price === "number" ? x.price : typeof x?.priceKRW === "number" ? x.priceKRW : undefined,
          resource: x?.resource ?? null,
          sex: itemSex,
          sexNormalized: itemSex,
          gender: itemSex,
          code,     // 프런트가 바로 사용
          examId,   // 오버라이드/매핑용 근거
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

/** -------------------- Handler -------------------- */
export async function GET(req: NextRequest, context: { params: { tenant: string } }) {
  try {
    const { params } = context;
    const url = req.nextUrl;
    const idParam = url.searchParams.get("id")?.trim();
    const packageIdParam = url.searchParams.get("packageId")?.trim();
    const id = idParam || packageIdParam;
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const t = await resolveTenantHybrid({
      slug: params.tenant,
      host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
    });
    if (!t) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
    const hospitalId = t.id;

    const pkg = await runAs(hospitalId, () =>
      prisma.package.findFirst({
        where: { id, hospitalId, visible: true },
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
      })
    );
    if (!pkg) return NextResponse.json({ error: "not found" }, { status: 404 });

    const period = derivePeriod(pkg);
    const tagsNormalized = normalizeTagsForRead(period.tagsWithPeriod);
    const optionGroups = deriveOptionGroupsFromTags(tagsNormalized);
    const baseExams = deriveBaseExamsFromTags(tagsNormalized);

    return NextResponse.json({
      id: pkg.id,
      title: pkg.title,
      name: pkg.title,
      summary: pkg.summary,
      category: pkg.category,
      price: pkg.price,
      priceKRW: pkg.price,
      tags: tagsNormalized,
      optionGroups,           // items[].code, items[].examId 포함
      baseExams,
      basicExams: baseExams,
      // 기간(호환 키 포함)
      startDate: period.from,
      endDate: period.to,
      periodFrom: period.from,
      periodTo: period.to,
      dateFrom: period.from,
      dateTo: period.to,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


