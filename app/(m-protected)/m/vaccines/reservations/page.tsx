// app/(m-protected)/m/vaccines/reservations/page.tsx
import { Suspense } from "react";
import KpiBar from "./_components/KpiBar.client";
import List from "./_components/List";

export default function Page() {
  return (
    <div className="space-y-4">
      {/* 실시간 KPI (API totals 기반) */}
      <KpiBar />

      {/* 목록 */}
      <Suspense fallback={<div className="p-10 text-slate-500">목록 불러오는 중…</div>}>
        <List />
      </Suspense>
    </div>
  );
}

