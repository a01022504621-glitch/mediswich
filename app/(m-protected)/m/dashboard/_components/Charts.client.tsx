"use client";
import { useMemo } from "react";

type Pt = { date:string; confirmed:number; canceled:number; capacity:number };

export function BarsAndLine({ data }: { data: Pt[] }) {
  const max = useMemo(() => Math.max(1, ...data.map(d => Math.max(d.confirmed, d.canceled))), [data]);
  return (
    <div className="w-full h-40 grid content-end gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0,1fr))` }}>
      {data.map((d, i) => {
        const hC = Math.round((d.confirmed / max) * 140);
        const hX = Math.round((d.canceled  / max) * 140);
        return (
          <div key={i} className="relative flex items-end justify-center">
            <div className="w-3 rounded-t bg-blue-500/80" style={{ height: hC }} title={`${d.date} 확정 ${d.confirmed}`} />
            <div className="absolute bottom-0 w-3 rounded-t bg-rose-500/60" style={{ height: hX }} title={`${d.date} 취소 ${d.canceled}`} />
          </div>
        );
      })}
      <div className="col-span-full flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{data[0]?.date?.slice(5)}</span><span>{data.at(-1)?.date?.slice(5)}</span>
      </div>
      <div className="col-span-full mt-1 flex gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-slate-600"><i className="inline-block w-3 h-3 bg-blue-500/80 rounded-sm" />확정</span>
        <span className="inline-flex items-center gap-1 text-slate-600"><i className="inline-block w-3 h-3 bg-rose-500/60 rounded-sm" />취소</span>
      </div>
    </div>
  );
}

export function CapacityMini({ data }: { data: Pt[] }) {
  // 오늘 기준
  const today = data.at(-1);
  const ratio = today && today.capacity > 0 ? Math.min(1, today.confirmed / today.capacity) : 0;
  const pct = Math.round(ratio * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 rounded-full" style={{ background: `conic-gradient(rgb(59 130 246) ${pct*3.6}deg, rgba(148,163,184,.35) 0)` }}>
        <div className="absolute inset-1 bg-white rounded-full flex items-center justify-center text-sm font-semibold">{pct}%</div>
      </div>
      <div className="text-sm text-slate-600">
        <div>오늘 가동률</div>
        <div className="text-slate-900 font-semibold">{today?.confirmed ?? 0} / {today?.capacity ?? 0}</div>
      </div>
    </div>
  );
}

