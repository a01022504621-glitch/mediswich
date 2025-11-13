// app/(m-protected)/m/dashboard/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import WidgetToolbar from "./_components/WidgetToolbar";
import EmptyState from "./_components/EmptyState";
import { TrendChart, DonutChart, Bars } from "./_components/charts";
import ReportButton from "./_components/ReportButton.client";

/* ───────── fetch helper: URL 단위 디듀프 ───────── */
type Inflight = { p: Promise<any>; c: AbortController; t: number };
const inflight = new Map<string, Inflight>();

async function jget<T>(url: string, { dedupeMs = 400 } = {}): Promise<T | null> {
  const now = Date.now();
  const prev = inflight.get(url);
  if (prev && now - prev.t < dedupeMs) return prev.p; // 짧은 간격 동일 URL 재사용
  if (prev) prev.c.abort("replaced-by-newer-request");

  const c = new AbortController();
  const p = fetch(url, { cache: "no-store", signal: c.signal })
    .then(async (r) => {
      const j = await r.json().catch(() => null);
      return j && j.ok ? (j as T) : null;
    })
    .finally(() => setTimeout(() => inflight.delete(url), dedupeMs));
  inflight.set(url, { p, c, t: now });
  return p;
}
const qs = (o: Record<string, any>) =>
  Object.entries(o)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

/* ───────── types ───────── */
type KPIRes = {
  ok: true;
  today: { requested: number; confirmed: number; amended: number; completed: number };
  window: { requested: number; confirmed: number; amended: number; completed: number } | null;
  range: { from: string; to: string };
};
type SeriesRes = {
  ok: true;
  series: Array<{ d: string; requested: number; confirmed: number; amended: number; completed: number }>;
};
type BrkRes = {
  ok: true;
  sex: { M: number; F: number; UNKNOWN: number };
  ageBands: Array<{ band: string; count: number }>;
  topPackages: Array<{ id: string; title: string; count: number; amountKRW: number }>;
  byDow: Array<{ dow: number; count: number }>;
  byHour: Array<{ h: number; count: number }>;
  topCompanies: Array<{ id: string; name: string; count: number; amountKRW: number }>;
};
const dowLabel = ["일", "월", "화", "수", "목", "금", "토"];

/* ───────── date utils: 일 단위 정규화 ───────── */
function normalizeRange(from: Date, to: Date) {
  const f = new Date(from);
  f.setHours(0, 0, 0, 0);
  const t = new Date(to);
  t.setHours(23, 59, 59, 999);
  return { from: f, to: t };
}

/* ───────── component ───────── */
export default function Dashboard() {
  /* 오늘 KPI */
  const [today, setToday] =
    useState<{ requested: number; confirmed: number; amended: number; completed: number } | null>(null);
  useEffect(() => {
    jget<KPIRes>("/api/m/dashboard/kpi?todayOnly=1").then((r) => setToday(r?.today ?? null));
  }, []);

  /* 공통 기간(모든 위젯 동기화) */
  const init = (() => {
    const base = new Date();
    const { from, to } = normalizeRange(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 6), base);
    return { from, to };
  })();
  const [range, setRange] = useState<{ from: Date; to: Date }>(init);
  const rangeKey = `${range.from.toISOString()}|${range.to.toISOString()}`;
  const lastRangeKeyRef = useRef<string>(rangeKey);
  const debounceRef = useRef<any>(null);

  /* 데이터 상태 */
  const [kpiWin, setKpiWin] = useState<KPIRes["window"]>(null);
  const [series, setSeries] = useState<SeriesRes["series"]>([]);
  const [sexData, setSexData] = useState<Array<{ name: string; value: number }>>([]);
  const [ageData, setAgeData] = useState<Array<{ name: string; value: number }>>([]);
  const [topPkg, setTopPkg] = useState<Array<{ name: string; count: number; amountKRW: number }>>([]);
  const [byDow, setByDow] = useState<Array<{ name: string; count: number }>>([]);
  const [byHour, setByHour] = useState<Array<{ name: string; count: number }>>([]);
  const [topCompanies, setTopCompanies] = useState<Array<{ name: string; amountKRW: number; count: number }>>([]);

  /* 한 번에 불러오기 */
  async function loadAll(from: Date, to: Date) {
    const q = qs({ from: from.toISOString(), to: to.toISOString() });
    const [k, s, b] = await Promise.all([
      jget<KPIRes>(`/api/m/dashboard/kpi?${q}`),
      jget<SeriesRes>(`/api/m/dashboard/series?${q}`),
      jget<BrkRes>(`/api/m/dashboard/breakdown?${q}`),
    ]);
    setKpiWin(k?.window ?? null);
    setSeries(s?.series ?? []);
    if (b) {
      setSexData([
        { name: "여", value: b.sex.F },
        { name: "남", value: b.sex.M },
        { name: "미상", value: b.sex.UNKNOWN },
      ]);
      setAgeData(
        (b.ageBands ?? [])
          .map(({ band, count }) => ({ name: band === "UNKNOWN" ? "미상" : band, value: count }))
          .sort((a, b) => {
            const order = ["20대 이하", "20대", "30대", "40대", "50대", "60대", "70대 이상", "미상"];
            return order.indexOf(a.name) - order.indexOf(b.name);
          }),
      );
      setTopPkg((b.topPackages ?? []).map((p) => ({ name: p.title, count: p.count, amountKRW: p.amountKRW })));
      setByDow((b.byDow ?? []).map((x) => ({ name: dowLabel[x.dow], count: x.count })));
      setByHour((b.byHour ?? []).map((x) => ({ name: `${x.h}시`, count: x.count })));
      setTopCompanies((b.topCompanies ?? []).map((c) => ({ name: c.name, amountKRW: c.amountKRW, count: c.count })));
    }
  }

  /* range 변경 시 1회만 로드(StrictMode/다중 툴바 방지) */
  useEffect(() => {
    if (lastRangeKeyRef.current === rangeKey) return;
    lastRangeKeyRef.current = rangeKey;
    loadAll(range.from, range.to);
  }, [rangeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 모든 툴바에서 공통 사용 */
  const onRangeChange = (from: Date, to: Date) => {
    const n = normalizeRange(from, to);
    const nextKey = `${n.from.toISOString()}|${n.to.toISOString()}`;
    if (nextKey === lastRangeKeyRef.current) return; // 동일 구간 무시
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRange(n);
    }, 120);
  };

  return (
    <div className="space-y-6">
      {/* 제목 + 보고서 */}
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">대시보드</h1>
        <ReportButton />
      </div>

      {/* KPI: 오늘 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "오늘 예약신청", key: "requested" },
          { label: "오늘 예약확정", key: "confirmed" },
          { label: "오늘 예약변경", key: "amended" },
          { label: "오늘 검진완료", key: "completed" },
        ].map((k) => (
          <div key={k.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{k.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {today ? (today as any)[k.key] : "-"}
            </div>
            <div className="mt-1 text-xs text-slate-500">집계 기준: 신청일, 변경은 변경일.</div>
          </div>
        ))}
      </div>

      {/* KPI 요약 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">최근 기간 요약</div>
          <WidgetToolbar
            storageKey="ms:kpi"
            syncGroup="dash"
            onChange={onRangeChange}
            defaultPreset={7}
            allowCustom
            note="기준: 예약신청일, 변경은 변경일"
          />
        </div>
        {kpiWin ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "예약신청", val: kpiWin.requested },
              { label: "예약확정", val: kpiWin.confirmed },
              { label: "예약변경", val: kpiWin.amended },
              { label: "검진완료", val: kpiWin.completed },
            ].map((b) => (
              <div key={b.label} className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm text-slate-500">{b.label}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{b.val}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>표시할 데이터가 없습니다.</EmptyState>
        )}
      </div>

      {/* 일자별 추세 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">일자별 추세</div>
          <WidgetToolbar
            storageKey="ms:trend"
            syncGroup="dash"
            onChange={onRangeChange}
            defaultPreset={7}
            allowCustom
            note="신청일 기준"
          />
        </div>
        {series?.length ? (
          <>
            <TrendChart data={series} />
            <div className="mt-2 text-xs text-slate-500">범례: 신청(파랑)·확정(초록)·변경(주황)·완료(빨강) — 일별 건수.</div>
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* 분포 + 상위 패키지 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">분포 및 상위 패키지</div>
          <WidgetToolbar
            storageKey="ms:break"
            syncGroup="dash"
            onChange={onRangeChange}
            defaultPreset={7}
            allowCustom
            note="신청일 기준"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium text-slate-800">성별 분포</div>
            {sexData?.length ? <DonutChart data={sexData} nameKey="name" valueKey="value" /> : <EmptyState />}
            <div className="mt-1 text-xs text-slate-500">최근 기간, 예약신청 기준 분포입니다.</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium text-slate-800">연령 분포</div>
            {ageData?.length ? <DonutChart data={ageData} nameKey="name" valueKey="value" /> : <EmptyState />}
            <div className="mt-1 text-xs text-slate-500">생년월일 미기재는 ‘미상’으로 집계합니다.</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium text-slate-800">상위 패키지</div>
            {topPkg?.length ? (
              <Bars data={topPkg} xKey="name" yKey="count" yName="건수" secondKey="amountKRW" secondName="매출(원)" />
            ) : (
              <EmptyState />
            )}
            <div className="mt-1 text-xs text-slate-500">최근 기간, 신청 기준 상위 10개. 왼쪽 ‘건수’, 오른쪽 ‘매출(원)’.</div>
          </div>
        </div>
      </div>

      {/* 요일/시간대 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">요일·시간대별 예약신청</div>
          <WidgetToolbar
            storageKey="ms:timebreak"
            syncGroup="dash"
            onChange={onRangeChange}
            defaultPreset={7}
            allowCustom
            note="신청일 기준"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium text-slate-800">요일별 신청</div>
            {byDow?.length ? <Bars data={byDow} xKey="name" yKey="count" yName="건수" /> : <EmptyState />}
            <div className="mt-1 text-xs text-slate-500">선택 기간의 신청을 요일 기준으로 집계.</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium text-slate-800">시간대별 신청</div>
            {byHour?.length ? <Bars data={byHour} xKey="name" yKey="count" yName="건수" /> : <EmptyState />}
            <div className="mt-1 text-xs text-slate-500">선택 기간의 신청을 시간대(0~23시) 기준으로 집계.</div>
          </div>
        </div>
      </div>

      {/* 고객사별 매출 순위 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">고객사별 매출 순위</div>
          <WidgetToolbar
            storageKey="ms:companies"
            syncGroup="dash"
            onChange={onRangeChange}
            defaultPreset={7}
            allowCustom
            note="신청일 기준"
          />
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          {topCompanies?.length ? (
            <Bars data={topCompanies} xKey="name" yKey="amountKRW" yName="매출(원)" secondKey="count" secondName="건수" />
          ) : (
            <EmptyState />
          )}
          <div className="mt-1 text-xs text-slate-500">최근 기간, 신청 기준 매출 상위 10개(개인 포함).</div>
        </div>
      </div>
    </div>
  );
}




