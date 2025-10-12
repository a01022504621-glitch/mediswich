"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PackagesListClient from "./PackagesList.client";
import CompanyCodeForm from "./CompanyCodeForm.client";

// **********************************
// NOTE: Type Definitions & Helpers (기능 유지)
// **********************************

type ApiItem = {
  id: string;
  title: string;
  summary?: string | null;
  price?: number | null;
  category: "NHIS" | "GENERAL" | "CORP";
  visible?: boolean;
  tags?: any | null;
  basicCount?: number;
  optionalCount?: number;
  startDate?: string | null;
  endDate?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type CardPkg = {
  id: string;
  title: string;
  summary: string | null;
  price: number | null;
  category: "NHIS" | "GENERAL" | "CORP";
  basicCount: number;
  optionalCount?: number;
  optionalChooseTotal?: number;
  tags?: any | null;
  periodLabel?: string | null;
};

// 탭 텍스트는 모바일에서 한 줄에 나오도록 최대한 짧게 유지
const CATS = [
  { key: "general", label: "종합검진", cat: "GENERAL" as const },
  { key: "nhis", label: "공단검진", cat: "NHIS" as const },
  { key: "corp", label: "기업/단체", cat: "CORP" as const },
];

function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function extractCountsFromTags(tags: any) {
  try {
    const g = tags?.groups ?? {};
    const basicItems = g?.basic?.items ?? g?.base?.items ?? g?.general?.items ?? [];
    const basicCount = Array.isArray(basicItems) ? basicItems.length : 0;
    const skip = new Set(["basic", "base", "general", "cancer"]);
    const optIds = Object.keys(g).filter((k) => !skip.has(k));
    const optionalGroupCount = optIds.length;
    let optionalChooseTotal = 0;
    for (const id of optIds) optionalChooseTotal += Number(g[id]?.chooseCount) || 0;
    return { basicCount, optionalGroupCount, optionalChooseTotal };
  } catch {
    return { basicCount: 0, optionalGroupCount: 0, optionalChooseTotal: 0 };
  }
}

function buildPeriodLabel(x: ApiItem) {
  const from =
    x.startDate || x.periodFrom || x.dateFrom || x.tags?.period?.from || x.tags?.dates?.from || null;
  const to =
    x.endDate || x.periodTo || x.dateTo || x.tags?.period?.to || x.tags?.dates?.to || null;
  if (!from && !to) return null;
  const f = from ? from.slice(0, 10) : "";
  const t = to ? to.slice(0, 10) : "";
  return [f, t].filter(Boolean).join(" ~ ");
}

// **********************************
// CatalogClient 컴포넌트 시작 (에러 제거 및 완벽 최종 UI/UX)
// **********************************

export default function CatalogClient({ slug, hospitalName }: { slug: string; hospitalName: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const urlCat = (sp.get("cat") || "").toLowerCase();
  const activeKey = CATS.some((c) => c.key === urlCat) ? urlCat : "general";
  const codeParam = sp.get("code")?.trim() || "";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<CardPkg[]>([]);

  // 탭 전환 로직 유지
  function setTab(key: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("cat", key);
    if (key !== "corp") params.delete("code");
    router.push(`?${params.toString()}`);
  }

  // 데이터 패칭 로직 유지
  useEffect(() => {
    let abort = false;
    async function run() {
      setErr(null);
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("cat", activeKey);
        if (activeKey === "corp" && codeParam) qs.set("code", codeParam);

        const res = await fetch(`/api/public/${slug}/packages?` + qs.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error("패키지를 불러오지 못했습니다.");

        const j = await res.json();
        const raw: ApiItem[] = Array.isArray(j?.packages) ? j.packages : Array.isArray(j?.items) ? j.items : [];
        const onlyVisible = raw.filter((x) => x.visible !== false);

        const mapped: CardPkg[] = onlyVisible.map((x) => {
          const t = extractCountsFromTags(x.tags);
          const basicCount = (Number.isFinite(x.basicCount) ? (x.basicCount as number) : 0) || t.basicCount;
          const optionalCount =
            (Number.isFinite((x as any).optionalCount) ? ((x as any).optionalCount as number) : 0) || t.optionalGroupCount;
          return {
            id: x.id,
            title: x.title,
            summary: x.summary ?? null,
            price: x.price ?? null,
            category: x.category,
            basicCount,
            optionalCount,
            optionalChooseTotal: t.optionalChooseTotal,
            tags: x.tags ?? null,
            periodLabel: buildPeriodLabel(x),
          };
        });

        if (!abort) setItems(mapped);
      } catch (e: any) {
        if (!abort) setErr(e?.message || "네트워크 오류가 발생했습니다.");
      } finally {
        if (!abort) setLoading(false);
      }
    }

    if (activeKey === "corp" && !codeParam) {
      setItems([]);
      setErr(null);
      setLoading(false);
      return;
    }
    run();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, codeParam, slug]);

  const activeLabel = useMemo(() => CATS.find((c) => c.key === activeKey)?.label ?? "종합검진", [activeKey]);

  return (
    <div className="mx-auto w-full">
      {/* 탭: 별도의 카드 안에 배치하여 공지 카드와 통일성 부여. mb-0으로 카드와 간격 최소화 */}
      <div className="p-4 bg-white/95 rounded-xl shadow-lg ring-1 ring-slate-100 mb-0">
        <div className="flex justify-between gap-2 bg-gray-100 p-1.5 rounded-full">
            {CATS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    "flex-grow text-center py-2 text-[14px] font-semibold transition-all duration-200 relative rounded-full whitespace-nowrap", // 폰트 크기 키움 (14px), 텍스트 짤림 방지
                    activeKey === t.key
                      // 선택된 탭: 파란색 배경 (Pill style)
                      ? "bg-white text-blue-600 shadow-md ring-1 ring-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {t.label}
                </button>
            ))}
        </div>
      </div>

      {/* 기업코드 입력 - 탭 바로 밑에 오도록 간격 최소화 (mt-3) */}
      {activeKey === "corp" && !codeParam && (
        <div className="mt-3 flex w-full justify-center px-4 sm:px-0">
          <div className="w-full max-w-md">
            <CompanyCodeForm />
          </div>
        </div>
      )}

      {/* 리스트 영역 - 탭/코드 입력과 간격 최소화 (mt-3) */}
      <div className="mt-3 px-0 sm:px-0">
        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center text-base font-medium text-blue-600 shadow-md ring-1 ring-slate-100">
            🏃‍♀️ **{activeLabel}** 패키지를 빠르게 준비 중이에요!
          </div>
        ) : err ? (
          <div className="rounded-xl bg-white p-8 text-center text-base font-medium text-rose-500 shadow-md ring-1 ring-slate-100">
            ⚠️ {err}
          </div>
        ) : items.length === 0 ? (
          /* 빈 목록 메시지: 패딩을 키우고 (p-12), 텍스트를 중앙 정렬하여 이쁘게 만듦 */
          <div className="rounded-xl bg-white p-12 text-center shadow-lg ring-1 ring-slate-100">
            {activeKey === "corp" && !codeParam ? (
              <p className="text-base text-slate-500 font-semibold leading-relaxed">
                🤝 **기업코드를 입력**하시면 <br /> 전용 패키지 목록을 확인할 수 있어요.
              </p>
            ) : (
              <p className="text-base text-slate-500 font-semibold leading-relaxed">
                😥 현재 표시할 **{activeLabel}** 패키지가 없습니다. <br />잠시 후 다시 확인해 주세요.
              </p>
            )}
          </div>
        ) : (
          <PackagesListClient packages={items} slug={slug} />
        )}
      </div>
    </div>
  );
}