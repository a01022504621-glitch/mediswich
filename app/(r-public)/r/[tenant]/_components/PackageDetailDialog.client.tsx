// app/(r-public)/r/[tenant]/_components/PackageDetailDialog.client.tsx
"use client";

import { useMemo } from "react";

type Row = { examId?: string; name?: string; code?: string; memo?: string; sex?: "A"|"M"|"F" };
type Groups = Record<string, { items?: Row[]; chooseCount?: number | null }>;
type Tags = { groups?: Groups; addons?: { name: string; sex: "A"|"M"|"F"; price: number | null }[] } | null;

export default function PackageDetailDialog({
  open, onClose, title, price, tags,
  getExamNameById,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  price?: number | null;
  tags: Tags;
  getExamNameById?: (id: string) => string | undefined; // 없으면 서버 저장된 name/memo/code만 사용
}) {
  const groups = (tags?.groups || {}) as Groups;

  const ordered = useMemo(() => {
    const basic = groups["basic"]?.items || groups["base"]?.items || groups["general"]?.items || [];
    // 기본 정렬: 상담/문진 → 기초 → 혈액 → 소변 → 영상/초음파 → 기타
    const BUCKETS: { key: string; test: (s: string) => boolean }[] = [
      { key: "문진/상담", test: s => /문진|상담/.test(s) },
      { key: "기초", test: s => /기초|신체검사|체성분|비만|BMI/.test(s) },
      { key: "혈액", test: s => /(혈액|CBC|Hb|AST|ALT|지질|콜레스테롤|당화|Glucose|Lipid)/i.test(s) },
      { key: "소변", test: s => /(소변|요검사|UA)/i.test(s) },
      { key: "영상/초음파", test: s => /(X-?ray|촬영|초음파|US|CT|MRI|Echo|ECG|심전도)/i.test(s) },
    ];
    const buckets: Record<string, Row[]> = { 기타: [] };
    for (const b of BUCKETS) buckets[b.key] = [];
    const getName = (r: Row) => r.name || (r.examId && getExamNameById?.(r.examId)) || "";

    for (const r of basic) {
      const n = getName(r);
      const slot = BUCKETS.find(b => b.test(n))?.key ?? "기타";
      buckets[slot].push(r);
    }

    const order = [...BUCKETS.map(b => b.key), "기타"].filter(k => buckets[k].length > 0);
    return { buckets, order };
  }, [tags, getExamNameById]);

  if (!open) return null;

  const priceText = typeof price === "number" ? new Intl.NumberFormat("ko-KR").format(price) + "원" : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {priceText && <div className="text-sm text-gray-600 mt-0.5">{priceText}</div>}
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm border hover:bg-gray-50">닫기</button>
        </div>

        <div className="p-5 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* 기본검사 */}
          {ordered.order.map((label) => (
            <section key={label}>
              <div className="mb-2 text-sm font-semibold text-gray-800">{label}</div>
              <ul className="space-y-1.5">
                {ordered.buckets[label].map((r, i) => (
                  <li key={r.examId ?? i} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <div className="truncate text-sm">{r.name || (r.examId && getExamNameById?.(r.examId)) || "검사"}</div>
                    {r.code && <span className="ml-3 shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{r.code}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* 선택검사 그룹들 */}
          {Object.entries(groups).filter(([k]) => !/^basic|base|general$/i.test(k)).map(([gid, g]) => (
            <section key={gid} className="mt-6">
              <div className="mb-2 text-sm font-semibold text-gray-800">
                {gid.startsWith("opt_") ? `선택검사 ${gid.replace("opt_","")}` : gid}
                {typeof g.chooseCount === "number" && g.chooseCount > 0 && (
                  <span className="ml-2 text-[12px] font-medium text-slate-600">필수 {g.chooseCount}개</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {(g.items || []).map((r, i) => (
                  <li key={r.examId ?? i} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <div className="truncate text-sm">{r.name || (r.examId && getExamNameById?.(r.examId)) || "검사"}</div>
                    {r.code && <span className="ml-3 shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{r.code}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

