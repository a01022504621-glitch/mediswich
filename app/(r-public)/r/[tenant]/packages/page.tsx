// /app/(r-public)/r/[tenant]/packages/page.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { useMemo, useState } from "react";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

function baseAndSelectCounts(tags: any) {
  const g = tags?.groups || {};
  const basicCount = Array.isArray(g?.basic?.items) ? g.basic.items.length : 0;
  const selectCount = Object.entries(g)
    .filter(([k]) => k !== "basic" && k !== "cancer")
    .reduce((sum, [, v]: any) => sum + (typeof v?.chooseCount === "number" ? v.chooseCount : 0), 0);
  return { basicCount, selectCount };
}

export default function PackagesPage({ params }: { params: { tenant: string } }) {
  const { data } = useSWR<{ ok: boolean; items: any[] }>(
    `/api/public/${params.tenant}/packages`,
    fetcher
  );
  const items = data?.items || [];

  const [tab, setTab] = useState<"NHIS" | "GENERAL" | "CORP">("NHIS");
  const list = useMemo(
    () => items.filter((x) => x.category === tab && x.visible === true),
    [items, tab]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex gap-2">
        {(["NHIS", "GENERAL", "CORP"] as const).map((k) => (
          <button
            key={k}
            className={`px-3 py-1.5 rounded-full border text-sm ${tab===k?"bg-gray-900 text-white border-gray-900":"border-gray-300 hover:bg-gray-50"}`}
            onClick={() => setTab(k)}
          >
            {k==="NHIS"?"국가검진":k==="GENERAL"?"개인검진":"기업/단체"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-gray-400 text-sm py-10 text-center">표시할 패키지가 없습니다.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((p) => {
            const { basicCount, selectCount } = baseAndSelectCounts(p.tags);
            return (
              <div key={p.id} className="rounded-2xl border shadow-sm p-5">
                <div className="text-base font-semibold mb-1">{p.title}</div>
                <div className="text-xs text-gray-500 mb-3">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 mr-1">
                    기본항목 {basicCount}개
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-slate-50 text-slate-700">
                    선택항목 {selectCount}개
                  </span>
                </div>
                <div className="font-bold mb-4">{(p.price || 0).toLocaleString()}원</div>
                <Link
                  href={`/r/${params.tenant}/packages/${p.id}`}
                  className="block text-center rounded-lg bg-blue-600 text-white py-2 hover:opacity-90"
                >
                  자세히 보기
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}




