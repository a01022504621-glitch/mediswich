"use client";

import { useMemo } from "react";

const items: {
  key: "예약신청"|"예약확정"|"검진완료"|"취소"|"검진미실시";
  label: string;
  color: string;
  ring: string;
}[] = [
  { key: "예약신청",   label: "예약신청",   color: "bg-blue-50 text-blue-800",   ring: "ring-blue-100" },
  { key: "예약확정",   label: "예약확정",   color: "bg-pink-50 text-pink-800",   ring: "ring-pink-100" },
  { key: "검진완료",   label: "검진완료",   color: "bg-green-50 text-green-800", ring: "ring-green-100" },
  { key: "취소",       label: "취소",       color: "bg-gray-50 text-gray-700",  ring: "ring-gray-100" },
  { key: "검진미실시", label: "검진미실시", color: "bg-amber-50 text-amber-800", ring: "ring-amber-100" },
];

export default function SummaryCards({
  counts,
  total,
  onPickStatus,
  floating = false, // 고정 패널일 때 true
}: {
  counts: Record<string, number>;
  total: number;
  onPickStatus: (status: string) => void;
  floating?: boolean;
}) {
  const list = useMemo(() => items, []);
  const container = floating ? "space-y-3" : "sticky top-20 space-y-3";

  return (
    <div className={container}>
      {/* 전체 */}
      <div className="card glass">
        <div className="card-inner">
          <div className="text-sm text-gray-500">전체</div>
          <div className="text-3xl font-semibold mt-1">{total.toLocaleString()} 건</div>
        </div>
      </div>

      {list.map((it) => (
        <button
          key={it.key}
          onClick={() => onPickStatus(it.key)}
          className={`w-full text-left rounded-2xl px-4 py-4 border ring-1 ${it.ring} ${it.color} hover:shadow-md transition`}
          title={`${it.label}만 보기`}
        >
          <div className="text-sm">{it.label}</div>
          <div className="text-2xl font-semibold mt-1">
            {(counts[it.key] ?? 0).toLocaleString()} 건
          </div>
        </button>
      ))}
    </div>
  );
}




