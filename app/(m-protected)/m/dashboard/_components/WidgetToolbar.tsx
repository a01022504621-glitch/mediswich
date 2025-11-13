// app/(m-protected)/m/dashboard/_components/WidgetToolbar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  storageKey: string;
  onChange: (from: Date, to: Date) => void;
  defaultPreset?: 7 | 14 | 30;
  allowCustom?: boolean;
  note?: string;
  syncGroup?: string; // 같은 그룹끼리 기간 동기화
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const fmt = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export default function WidgetToolbar({
  storageKey,
  onChange,
  defaultPreset = 7,
  allowCustom = true,
  note,
  syncGroup = "dashboard",
}: Props) {
  const uid = useRef(Math.random().toString(36).slice(2));
  const evtName = `ms:range:${syncGroup}`;

  const [preset, setPreset] = useState<7 | 14 | 30>(() => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(`${storageKey}:preset`) : null;
    return (v === "14" ? 14 : v === "30" ? 30 : defaultPreset) as 7 | 14 | 30;
  });
  const [from, setFrom] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate() - (preset - 1));
  });
  const [to, setTo] = useState<Date>(() => new Date());

  // 내 변경 → 모든 위젯에 브로드캐스트
  const broadcast = (f: Date, t: Date) => {
    try {
      window.dispatchEvent(new CustomEvent(evtName, { detail: { from: f, to: t, source: uid.current } }));
    } catch {}
  };

  useEffect(() => {
    const today = new Date();
    const f = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (preset - 1));
    setFrom(f); setTo(today);
    onChange(f, today);
    broadcast(f, today);
    try { window.localStorage.setItem(`${storageKey}:preset`, String(preset)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  // 다른 위젯 변경 수신
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.source === uid.current) return; // 자기 자신 이벤트 무시
      const f = new Date(e.detail.from);
      const t = new Date(e.detail.to);
      if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return;
      setFrom(f); setTo(t);
      onChange(f, t);
      // 프리셋 동기화(정확히 7/14/30일이면 맞춰줌)
      const diff = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
      if (diff === 7 || diff === 14 || diff === 30) setPreset(diff as 7 | 14 | 30);
    };
    window.addEventListener(evtName, handler as any);
    return () => window.removeEventListener(evtName, handler as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onManual = (fStr: string, tStr: string) => {
    const f = new Date(fStr); const t = new Date(tStr);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
      setFrom(f); setTo(t);
      onChange(f, t);
      broadcast(f, t);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={preset}
        onChange={(e) => setPreset(Number(e.target.value) as 7 | 14 | 30)}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        aria-label="기간 프리셋"
      >
        <option value={7}>최근 7일</option>
        <option value={14}>최근 14일</option>
        <option value={30}>최근 30일</option>
      </select>

      {allowCustom && (
        <div className="flex items-center gap-1 text-sm">
          <input
            type="date"
            value={fmt(from)}
            className="rounded border border-slate-300 px-2 py-1"
            onChange={(e) => onManual(e.target.value, fmt(to))}
          />
          <span>~</span>
          <input
            type="date"
            value={fmt(to)}
            className="rounded border border-slate-300 px-2 py-1"
            onChange={(e) => onManual(fmt(from), e.target.value)}
          />
        </div>
      )}

      {note && <span className="ml-2 text-xs text-slate-500">{note}</span>}
    </div>
  );
}


