// components/PackageDetail.tsx
"use client";

import { useState, useMemo } from "react";
import { getBasicItems, getOptionGroups, getAddons } from "@/lib/packageTags";

type Pkg = {
  id: string;
  title: string;
  price?: number | null;
  tags?: any;
};

const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

function sexLabel(v?: string) {
  if (v === "M") return "남";
  if (v === "F") return "여";
  return "전체";
}

export default function PackageDetail({ pkg }: { pkg: Pkg }) {
  const [open, setOpen] = useState(false);

  const basic = useMemo(() => getBasicItems(pkg?.tags), [pkg?.tags]);
  const options = useMemo(() => getOptionGroups(pkg?.tags), [pkg?.tags]);
  const addons = useMemo(() => getAddons(pkg?.tags), [pkg?.tags]);

  const optionGroupsCount = options.length;
  const chooseSum = options.reduce((a, g) => a + (g.chooseCount || 0), 0);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold truncate">{pkg.title}</div>
        {typeof pkg.price === "number" && (
          <div className="ml-auto text-base font-bold">{pkg.price.toLocaleString()}원</div>
        )}
      </div>

      {/* 요약 배지 */}
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
          기본 {basic.length}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
          선택묶음 {optionGroupsCount}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
          필수합 {chooseSum}
        </span>
        <button
          className={clsx(
            "ml-auto text-sm underline underline-offset-4 hover:opacity-80",
            "text-gray-700"
          )}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "접기" : "자세히 보기"}
        </button>
      </div>

      {!open ? null : (
        <div className="mt-5 space-y-8">
          {/* 기본 검사 */}
          <section>
            <div className="mb-2 text-sm font-semibold text-gray-700">기본검사</div>
            {basic.length === 0 ? (
              <div className="text-sm text-gray-400">등록된 기본검사가 없습니다.</div>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                {basic.map((r, i) => (
                  <li key={r.examId ?? i} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 truncate">
                      {r.name || r.memo || r.code || "검사"}
                    </div>
                    <div className="text-xs text-gray-500">{sexLabel(r.sex)}</div>
                    {r.code ? (
                      <div className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700 border border-gray-200">
                        {r.code}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 선택 검사 그룹 */}
          <section>
            <div className="mb-2 text-sm font-semibold text-gray-700">선택검사</div>
            {options.length === 0 ? (
              <div className="text-sm text-gray-400">등록된 선택검사 그룹이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {options.map((g) => (
                  <div key={g.id} className="rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <div className="text-sm font-medium">그룹 {g.id.replace("opt_", "")}</div>
                      <div className="text-xs text-gray-600">필수 선택 {g.chooseCount}개</div>
                    </div>
                    {g.items.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-400">항목 없음</div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {g.items.map((r, i) => (
                          <li key={r.examId ?? i} className="flex items-center gap-3 px-3 py-2">
                            <div className="flex-1 truncate">
                              {r.name || r.memo || r.code || "검사"}
                            </div>
                            <div className="text-xs text-gray-500">{sexLabel(r.sex)}</div>
                            {r.code ? (
                              <div className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700 border border-gray-200">
                                {r.code}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 추가검사 */}
          <section>
            <div className="mb-2 text-sm font-semibold text-gray-700">추가검사</div>
            {addons.length === 0 ? (
              <div className="text-sm text-gray-400">등록된 추가검사가 없습니다.</div>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                {addons.map((a, i) => (
                  <li key={i} className="grid grid-cols-12 items-center px-3 py-2 text-sm">
                    <div className="col-span-7 truncate">{a.name}</div>
                    <div className="col-span-2 text-gray-500">{sexLabel(a.sex)}</div>
                    <div className="col-span-3 text-right">
                      {a.price != null ? `${a.price.toLocaleString()}원` : "-"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}



