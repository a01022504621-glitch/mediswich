"use client";
import { useMemo } from "react";

export default function ReportButton({ from, to }: { from?: Date; to?: Date }) {
  const href = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set("from", from.toISOString());
    if (to) q.set("to", to.toISOString());
    return `/m/dashboard/report?${q.toString()}`;
  }, [from, to]);

  return (
    <a
      href={href}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
      aria-label="보고서 페이지 열기"
    >
      보고서 보기
    </a>
  );
}


