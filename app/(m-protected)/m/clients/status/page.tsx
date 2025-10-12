"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  participants: number;
};

function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

const card = "bg-white shadow-lg rounded-2xl border border-gray-200";
const sectionHead = "border-b border-gray-100 px-6 py-4 text-base font-semibold text-gray-900";
const body = "px-6 py-6";

const pct = (a: number, b: number) => (!b ? 0 : Math.round((a / b) * 100));
const num = (n: number) => (n || 0).toLocaleString();
const dBadge = (d: number) =>
  d < 0 ? "bg-gray-200 text-gray-700" : d <= 3 ? "bg-red-100 text-red-700" : d <= 7 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";

const dday = (end: string) => {
  if (!end) return 0;
  const e = new Date(end);
  const t = new Date();
  e.setHours(0, 0, 0, 0);
  t.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - t.getTime()) / 86400000);
};

export default function ClientsStatusPage() {
  const [kw, setKw] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/clients", { cache: "no-store" });
    const data: Row[] = res.ok ? await res.json() : [];
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 필터링/매핑
  const items = useMemo(() => {
    const f = rows
      .filter((r) => (!kw.trim() || r.name.includes(kw.trim())))
      .filter((r) => (!start || r.startDate >= start))
      .filter((r) => (!end || r.endDate <= end))
      .map((r) => {
        const d = dday(r.endDate);
        return {
          id: r.id,
          name: r.name,
          startDate: r.startDate,
          endDate: r.endDate,
          dDay: d,
          registered: r.participants || 0,
          reserved: 0,
          completed: 0,
          noShow: 0,
          cancelled: 0,
          remaining: r.participants || 0,
          supportSpent: 0,
        };
      });
    return urgentOnly ? f.filter((x) => x.dDay <= 7) : f;
  }, [rows, kw, start, end, urgentOnly]);

  // Totals
  const totals = useMemo(
    () =>
      items.reduce(
        (a, it) => {
          a.registered += it.registered;
          a.reserved += it.reserved;
          a.completed += it.completed;
          a.noShow += it.noShow;
          a.cancelled += it.cancelled;
          a.remaining += it.remaining;
          return a;
        },
        { registered: 0, reserved: 0, completed: 0, noShow: 0, cancelled: 0, remaining: 0 }
      ),
    [items]
  );

  const totalCompletedPct = pct(totals.completed, totals.registered);
  const totalReservedPct = pct(totals.reserved, totals.registered);
  const totalNoShowPct = pct(totals.noShow, totals.reserved);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        <span className="text-sky-600">고객사</span> 검진 현황
      </h1>

      {/* 필터 바 */}
      <section className={card}>
        <div className={sectionHead}>필터</div>
        <div className={body + " grid grid-cols-1 md:grid-cols-4 gap-4"}>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="고객사명 검색"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600">시작</label>
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600">종료</label>
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} />
            마감 임박만(D≤7)
          </label>
          <div className="md:col-span-4 flex gap-2">
            <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">적용</button>
            <button onClick={() => { setKw(""); setStart(""); setEnd(""); setUrgentOnly(false); }} className="px-4 py-2 rounded-lg border text-sm">
              초기화
            </button>
          </div>
        </div>
      </section>

      {/* KPI 카드 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={card}><div className="px-6 py-4 text-xs font-semibold text-gray-500 border-b">등록인원</div><div className="px-6 py-5 text-2xl font-bold tabular-nums">{num(totals.registered)}</div></div>
        <div className={card}><div className="px-6 py-4 text-xs font-semibold text-gray-500 border-b">예약 / 예약률</div><div className="px-6 py-5 text-2xl font-bold tabular-nums">{num(totals.reserved)}<span className="ml-2 text-base font-medium text-gray-500">({totalReservedPct}%)</span></div></div>
        <div className={card}><div className="px-6 py-4 text-xs font-semibold text-gray-500 border-b">완료 / 완료율</div><div className="px-6 py-5 text-2xl font-bold tabular-nums">{num(totals.completed)}<span className="ml-2 text-base font-medium text-gray-500">({totalCompletedPct}%)</span></div></div>
        <div className={card}><div className="px-6 py-4 text-xs font-semibold text-gray-500 border-b">노쇼 / 노쇼율</div><div className="px-6 py-5 text-2xl font-bold tabular-nums">{num(totals.noShow)}<span className="ml-2 text-base font-medium text-gray-500">({totalNoShowPct}%)</span></div></div>
      </section>

      {/* 고객사별 테이블 */}
      <section className={card}>
        <div className={sectionHead}>고객사별 진행 현황</div>
        <div className={body + " overflow-x-auto"}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">고객사</th>
                <th className="py-2 pr-4">기간</th>
                <th className="py-2 pr-4">D-Day</th>
                <th className="py-2 pr-4">등록</th>
                <th className="py-2 pr-4">예약</th>
                <th className="py-2 pr-4">완료</th>
                <th className="py-2 pr-4">진행률</th>
                <th className="py-2 pr-4">노쇼</th>
                <th className="py-2 pr-4">취소</th>
                <th className="py-2 pr-4">남은인원</th>
                <th className="py-2 pr-4">지원금 집행</th>
                <th className="py-2 pr-4">액션</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={12} className="py-8 text-center text-gray-400">불러오는 중…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={12} className="py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>}
              {!loading && items.map((it) => {
                const progress = pct(it.completed, it.registered);
                return (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{it.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{it.startDate} ~ {it.endDate}</td>
                    <td className="py-2 pr-4"><span className={clsx("px-2 py-1 rounded-md text-xs", dBadge(it.dDay))}>{it.dDay < 0 ? `종료 ${Math.abs(it.dDay)}일` : `D-${it.dDay}`}</span></td>
                    <td className="py-2 pr-4 tabular-nums">{num(it.registered)}</td>
                    <td className="py-2 pr-4 tabular-nums">{num(it.reserved)}<span className="text-xs text-gray-500 ml-1">({pct(it.reserved, it.registered)}%)</span></td>
                    <td className="py-2 pr-4 tabular-nums">{num(it.completed)}<span className="text-xs text-gray-500 ml-1">({pct(it.completed, it.registered)}%)</span></td>
                    <td className="py-2 pr-4" style={{ minWidth: 160 }}><div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-900" style={{ width: `${progress}%` }} /></div></td>
                    <td className="py-2 pr-4 tabular-nums">{num(it.noShow)}</td>
                    <td className="py-2 pr-4 tabular-nums">{num(it.cancelled)}</td>
                    <td className="py-2 pr-4 tabular-nums">{num(it.remaining)}</td>
                    <td className="py-2 pr-4 tabular-nums">{num(it.supportSpent)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <Link href={`/m/clients/${it.id}`} className="px-2.5 py-1.5 rounded-md text-xs border border-gray-300 hover:bg-gray-50">상세</Link>
                        <Link href={`/m/clients/${it.id}/unreserved`} className="px-2.5 py-1.5 rounded-md text-xs border border-gray-300 hover:bg-gray-50">미예약자</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
