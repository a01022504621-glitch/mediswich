"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { SVGProps } from "react";
import type { CardPkg } from "./CatalogClient.client";

// --- (이전과 동일한 타입 및 헬퍼 함수들) ---
type Cat = "nhis" | "general" | "corp";
type Props =
  | { tenant: string; type: Cat }
  | { packages: CardPkg[]; slug: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const ChevronRight = (props: SVGProps<SVGSVGElement>) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}> <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /> </svg> );
const XMark = (props: SVGProps<SVGSVGElement>) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}> <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /> </svg> );

// ✨ 1. 데이터를 올바르게 해석하는 새로운 `readGroups` 함수로 교체
// ==================================================================
function readGroups(tags: any) {
    if (!tags || typeof tags !== 'object') {
        return { basic: [], groups: [] };
    }

    const groupMeta = tags.groupMeta || {};
    const groupsData = tags.groups || {};
    const groupOrder = tags.groupOrder || Object.keys(groupsData);

    const basicItems = (groupsData.base || []).map((item: any) => item.name || '').filter(Boolean);
    
    const optionalGroups = groupOrder
        .filter((gid: string) => gid !== 'base' && groupMeta[gid])
        .map((gid: string) => {
            const meta = groupMeta[gid];
            const items = (groupsData[gid] || []).map((item: any) => item.name || '').filter(Boolean);
            return {
                id: gid,
                label: meta.label || `선택검사 ${gid.replace('opt_', '')}`,
                chooseCount: Number(meta.chooseCount) || 0,
                items: items,
            };
        });

    return { basic: basicItems, groups: optionalGroups };
}
// ==================================================================


export default function PackagesListClient(props: Props) {
  // --- (컴포넌트 로직은 이전과 대부분 동일) ---
  const isFetchMode = (p: Props): p is { tenant: string; type: Cat } => "tenant" in p && "type" in p;
  const isDataMode = (p: Props): p is { packages: CardPkg[]; slug: string } => "packages" in p && "slug" in p;

  const router = useRouter();

  let slug = "";
  let packages: CardPkg[] = [];

  if (isFetchMode(props)) {
    slug = props.tenant;
    const { data } = useSWR<{ items: CardPkg[] }>(
      `/api/r/${props.tenant}/packages?type=${props.type}`,
      fetcher,
      { revalidateOnFocus: false, keepPreviousData: true }
    );
    packages = data?.items ?? [];
  } else if (isDataMode(props)) {
    slug = props.slug;
    packages = props.packages;
  }

  const [openId, setOpenId] = useState<string | null>(null);
  const [showBasic, setShowBasic] = useState(false);

  const opened = useMemo(() => packages.find((p) => p.id === openId) ?? null, [openId, packages]);
  const parsed = useMemo(() => (opened ? readGroups(opened.tags) : null), [opened]);

  return (
    <>
      {/* 목록 (수정 없음) */}
      <ul className="space-y-2">
        {packages.map((p) => (
          <li
            key={p.id}
            className="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm transition-all duration-150 hover:ring-blue-300 hover:shadow-md"
          >
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pt-1">
                    <h3 className="text-base font-bold text-slate-900 truncate">{p.title}</h3>
                  </div>
                  <div className="flex shrink-0 flex-col items-end ml-3">
                    {Number.isFinite(p.price) && (
                      <div className="flex items-baseline">
                        <span className="text-sm font-bold text-slate-600 mr-0.5">
                          {Number(p.price).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">원</span>
                      </div>
                    )}
                    {p.periodLabel && (
                      <div className="mt-0.5 mb-2 text-[11px] font-medium text-slate-500">🗓️ {p.periodLabel}</div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }}
                      className="flex items-center rounded-lg bg-blue-500 text-white px-3 py-1 text-[13px] font-semibold hover:bg-blue-600 transition duration-150 shadow-sm"
                    >
                      자세히 보기
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    기본 {p.basicCount}개
                  </span>
                  {p.optionalChooseTotal ? (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      선택 {p.optionalChooseTotal}개
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 상세 모달 (UI 로직 수정) */}
      {opened && parsed && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end justify-center" onClick={() => { setOpenId(null); setShowBasic(false); }}>
          <div
            className="w-full max-w-xl rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200 animate-in slide-in-from-bottom duration-300 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{opened.title}</h2>
                {Number.isFinite(opened.price) && (
                  <div className="mt-1 text-lg font-bold text-blue-600">{Number(opened.price).toLocaleString()}원</div>
                )}
                {opened.periodLabel && (
                  <div className="text-[13px] text-slate-500 mt-1">🗓️ 검진기간 {opened.periodLabel}</div>
                )}
              </div>
              <button onClick={() => { setOpenId(null); setShowBasic(false); }} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition">
                <XMark className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {/* ✨ 2. 기본검사 UI를 '뱃지' 형태로 수정 및 '전체보기' 기능 복원 */}
              <div className="px-5 pb-4">
                <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">기본검사 항목 ({parsed.basic.length}개)</div>
                    {parsed.basic.length > 8 && ( // 뱃지 8개 이상일 때 전체보기 버튼 노출
                      <button onClick={() => setShowBasic(true)} className="text-[12px] font-medium text-blue-600 hover:text-blue-700 flex items-center">
                        전체보기 <ChevronRight className="w-3 h-3 ml-0.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {parsed.basic.slice(0, 8).map((name, idx) => (
                        <span key={idx} className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-700">
                            {name}
                        </span>
                    ))}
                    {parsed.basic.length > 8 && <span className="text-[11px] text-gray-500 self-center">...</span>}
                  </div>
                </div>
              </div>

              {/* 선택검사 그룹 (정상 작동) */}
              <div className="px-5 pb-5 space-y-2">
                {parsed.groups.map((g) => (
                  <div key={g.id} className="rounded-xl ring-1 ring-slate-200 p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-slate-800">{g.label}</div>
                      {g.chooseCount > 0 && (
                        <span className="text-[11px] rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 font-semibold">
                          {g.chooseCount}개 필수선택
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((name, idx) => (
                        <span key={`${g.id}_${idx}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA (수정 없음) */}
            <div className="p-5 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-sm">
              <button
                onClick={() => router.push(`/r/${slug}/schedule?packageId=${opened.id}`)}
                className="w-full h-14 rounded-xl bg-blue-600 text-white text-base font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition"
              >
                예약하러 가기
              </button>
            </div>
          </div>

          {/* 기본검사 전체보기 모달 (정상 작동) */}
          {showBasic && (
            <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => setShowBasic(false)}>
              <div className="w-full max-w-[560px] rounded-xl bg-white shadow-xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-slate-100">
                  <div className="text-lg font-bold text-slate-800">기본검사 전체 ({parsed.basic.length}개)</div>
                  <button onClick={() => setShowBasic(false)} className="p-1 rounded-full text-slate-500 hover:bg-slate-100 transition"><XMark className="w-4 h-4" /></button>
                </div>
                <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
                  {parsed.basic.map((n, i) => (
                    <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-[14px] text-slate-700">{n}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}