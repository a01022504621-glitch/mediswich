"use client";
import useSWR from "swr";
import { Syringe, CheckCircle2, AlertTriangle, Users } from "lucide-react";

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function KpiBar() {
  const { data } = useSWR("/api/vaccines/reservations?date=today", fetcher, {
    refreshInterval: 5000,
  });
  const t = data?.totals ?? { reserved: 0, checked_in: 0, done: 0, no_show: 0 };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi icon={Users} label="오늘 예약" value={t.reserved} />
      <Kpi icon={Syringe} label="체크인" value={t.checked_in} />
      <Kpi icon={CheckCircle2} label="접종완료" value={t.done} />
      <Kpi icon={AlertTriangle} label="노쇼" value={t.no_show} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 flex items-center gap-3">
      <Icon className="h-6 w-6" strokeWidth={1.8} />
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

