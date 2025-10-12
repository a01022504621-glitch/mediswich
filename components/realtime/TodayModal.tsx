"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeRow } from "./ResultsTable";

export default function TodayModal({ rows }: { rows: RealtimeRow[] }) {
  const [open, setOpen] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);

  const todayKey = useMemo(() => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return `realtime:hideToday:${ymd}`;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hidden = localStorage.getItem(todayKey);
    if (!hidden) setOpen(true);
  }, [todayKey]);

  const counts = useMemo(() => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const base = { 예약신청:0, 예약확정:0, 검진완료:0, 취소:0, 검진미실시:0 };
    rows.forEach((r) => {
      // 오늘 데이터만 간단히 집계(예: 예약신청일 기준)
      if (r.appliedAt === ymd && r.status in base) (base as any)[r.status] += 1;
    });
    return base;
  }, [rows]);

  const close = () => {
    if (dontShowToday && typeof window !== "undefined") {
      localStorage.setItem(todayKey, "1");
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={close} />
      <div className="relative z-10 w-[560px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="font-semibold">오늘의 예약현황</div>
          <button className="text-gray-500 hover:text-black" onClick={close}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(counts).map(([k,v]) => (
              <div key={k} className="border rounded-xl p-3 bg-gray-50">
                <div className="text-sm text-gray-600">{k}</div>
                <div className="text-xl font-semibold">{v} 건</div>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={dontShowToday} onChange={(e)=>setDontShowToday(e.target.checked)} />
            오늘 하루 숨기기
          </label>
        </div>

        <div className="px-5 pb-4 flex justify-end">
          <button className="btn" onClick={close}>닫기</button>
        </div>
      </div>
    </div>
  );
}



