"use client";

const summaryRows: {
  key: "예약신청"|"예약확정"|"검진완료"|"취소"|"검진미실시";
  label: string;
  dot: string;   // 점 색
  accent: string; // 숫자 색
}[] = [
  { key: "예약신청",   label: "예약신청",   dot: "bg-blue-500",  accent: "text-blue-700" },
  { key: "예약확정",   label: "예약확정",   dot: "bg-rose-500",  accent: "text-rose-700" },
  { key: "검진완료",   label: "검진완료",   dot: "bg-emerald-500",accent: "text-emerald-700" },
  { key: "취소",       label: "취소",       dot: "bg-gray-500",  accent: "text-gray-700" },
  { key: "검진미실시", label: "검진미실시", dot: "bg-amber-500", accent: "text-amber-700" },
];

export default function SummaryQuickCard({
  counts,
  total,
  onPickStatus,
}: {
  counts: Record<string, number>;
  total: number;
  onPickStatus: (status: string) => void;
}) {
  return (
    <div className="card glass shadow-lg">
      {/* 헤더: 유리막 + 그라데이션 */}
      <div className="px-5 pt-5 pb-3 rounded-t-2xl bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-md border-b">
        <div className="flex items-end justify-between">
          <div className="text-sm font-semibold text-gray-700">진행 현황</div>
          <div className="text-3xl font-semibold">{total.toLocaleString()} <span className="text-base font-medium text-gray-500">건</span></div>
        </div>
      </div>

      {/* 바디: 리스트 */}
      <div className="p-4 space-y-2">
        {summaryRows.map((r) => (
          <button
            key={r.key}
            onClick={() => onPickStatus(r.key)}
            className="w-full group rounded-xl px-3 py-2.5 border bg-white/70 hover:bg-white transition shadow-sm hover:shadow-md text-left"
            title={`${r.label}만 보기`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} />
                <span className="text-[13px] text-gray-600">{r.label}</span>
              </div>
              <div className={`text-xl font-semibold ${r.accent}`}>
                {(counts[r.key] ?? 0).toLocaleString()}<span className="ml-0.5 text-sm text-gray-500">건</span>
              </div>
            </div>
          </button>
        ))}

        <div className="pt-2 text-xs text-gray-500">
          • 항목을 클릭하면 해당 상태로 필터됩니다.
        </div>
      </div>
    </div>
  );
}
