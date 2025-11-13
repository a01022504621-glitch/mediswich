// app/(m-protected)/m/dashboard/report/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetToolbar from "../_components/WidgetToolbar";
import { TrendChart, DonutChart, Bars } from "../_components/charts";

/* ===== API types & helpers ===== */
type KPIRes = {
  ok: true;
  today: { requested: number; confirmed: number; amended: number; completed: number };
  window: { requested: number; confirmed: number; amended: number; completed: number } | null;
  range: { from: string; to: string };
};
type SeriesItem = { d: string; requested: number; confirmed: number; amended: number; completed: number };
type SeriesRes = { ok: true; series: Array<SeriesItem> };
type BrkRes = {
  ok: true;
  sex: { M: number; F: number; UNKNOWN: number };
  ageBands: Array<{ band: string; count: number }>;
  topPackages: Array<{ id: string; title: string; count: number; amountKRW: number }>;
  byDow: Array<{ dow: number; label: string; count: number }>;
  byHour: Array<{ h: number; count: number }>;
  topCompanies: Array<{ id: string; name: string; count: number; amountKRW: number }>;
};

async function jget<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    if (!j?.ok) return null;
    return j as T;
  } catch {
    return null;
  }
}
const qs = (o: Record<string, any>) =>
  Object.entries(o)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "-");
const percent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const arrow = (d: number) => (d > 0 ? "▲" : d < 0 ? "▼" : "—");
const fmtDelta = (now: number, prev: number) => {
  const diff = now - prev;
  const ratio = prev ? Math.round((diff / prev) * 100) : 0;
  return `${arrow(diff)}${Math.abs(ratio)}%${diff ? `, ${diff > 0 ? "+" : ""}${diff}건` : ""}`;
};

/* ===== View ===== */
const AGE_ORDER = ["20대 이하", "20대", "30대", "40대", "50대", "60대", "70대 이상"];
type MetricKey = "requested" | "confirmed" | "amended" | "completed";

export default function ReportPage() {
  // 보고기간
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6);
    return { from, to };
  });

  // 생성일시(SSR↔CSR 시간차 보정)
  const [nowText, setNowText] = useState("");
  useEffect(() => setNowText(new Date().toLocaleString()), []);

  // 데이터 상태
  const [kpi, setKpi] = useState<KPIRes["window"]>(null);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [seriesPrev, setSeriesPrev] = useState<SeriesItem[]>([]);
  const [sexData, setSexData] = useState<Array<{ name: string; value: number }>>([]);
  const [ageData, setAgeData] = useState<Array<{ name: string; value: number }>>([]);
  const [topPkg, setTopPkg] = useState<Array<{ name: string; count: number; amountKRW: number }>>([]);
  const [byDow, setByDow] = useState<Array<{ name: string; count: number }>>([]);
  const [byHour, setByHour] = useState<Array<{ name: string; count: number }>>([]);
  const [topCompanies, setTopCompanies] = useState<Array<{ name: string; count: number; amountKRW: number }>>([]);

  const loadAll = async (from: Date, to: Date) => {
    const q = qs({ from: from.toISOString(), to: to.toISOString() });
    const [k, s, b] = await Promise.all([
      jget<KPIRes>(`/api/m/dashboard/kpi?${q}`),
      jget<SeriesRes>(`/api/m/dashboard/series?${q}`),
      jget<BrkRes>(`/api/m/dashboard/breakdown?${q}`),
    ]);
    setKpi(k?.window ?? null);
    setSeries(s?.series ?? []);

    if (b) {
      // "미상" 제외
      setSexData([
        { name: "여", value: b.sex.F },
        { name: "남", value: b.sex.M },
      ]);
      setAgeData(
        b.ageBands
          .filter(({ band }) => band !== "UNKNOWN")
          .map(({ band, count }) => ({ name: band, value: count }))
          .sort((a, b) => AGE_ORDER.indexOf(a.name) - AGE_ORDER.indexOf(b.name)),
      );
      setTopPkg(b.topPackages.map((p) => ({ name: p.title, count: p.count, amountKRW: p.amountKRW })));
      setByDow(b.byDow.map((x) => ({ name: x.label, count: x.count })));
      setByHour(b.byHour.map((x) => ({ name: `${x.h}시`, count: x.count })));
      setTopCompanies(b.topCompanies.map((c) => ({ name: c.name, count: c.count, amountKRW: c.amountKRW })));
    }

    // 전기(이전 동일 기간) 시계열 로드
    const days = Math.max(1, Math.ceil((+to - +from) / 86400000) + 1);
    const prevTo = new Date(from.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
    const qPrev = qs({ from: prevFrom.toISOString(), to: prevTo.toISOString() });
    const sPrev = await jget<SeriesRes>(`/api/m/dashboard/series?${qPrev}`);
    setSeriesPrev(sPrev?.series ?? []);
  };

  useEffect(() => {
    loadAll(range.from, range.to);
  }, [range.from, range.to]);

  // 합계/전환/매출 보조 계산
  const calc = useMemo(() => {
    const sum = (key: MetricKey, arr: SeriesItem[]) => arr.reduce((a, v) => a + (v[key] ?? 0), 0);

    const cur = {
      req: sum("requested", series),
      cfm: sum("confirmed", series),
      amd: sum("amended", series),
      cmp: sum("completed", series),
    };
    const prv = {
      req: sum("requested", seriesPrev),
      cfm: sum("confirmed", seriesPrev),
      amd: sum("amended", seriesPrev),
      cmp: sum("completed", seriesPrev),
    };

    const convReq2Cfm = percent(cur.cfm, cur.req); // 신청→확정 전환율
    const convCfm2Cmp = percent(cur.cmp, cur.cfm); // 확정→완료 전환율
    const convReq2Cmp = percent(cur.cmp, cur.req); // 전체 성사율

    // 매출 총합/평균/집중도
    const salesSum = topPkg.reduce((s, p) => s + (p.amountKRW || 0), 0);
    const arpb = cur.cmp ? Math.round(salesSum / cur.cmp) : 0; // 완료 1건당 평균 매출
    const sortedPkgs = [...topPkg].sort((a, b) => b.amountKRW - a.amountKRW);
    const top1 = sortedPkgs[0];
    const top3 = sortedPkgs.slice(0, 3);
    const topShare = salesSum ? Math.round(((top1?.amountKRW || 0) / salesSum) * 100) : 0;
    const top3Share = salesSum
      ? Math.round((top3.reduce((s, p) => s + (p.amountKRW || 0), 0) / salesSum) * 100)
      : 0;

    // 피크 2시간 집중도
    const totalReqByHour = byHour.reduce((s, v) => s + v.count, 0);
    const topHours = [...byHour].sort((a, b) => b.count - a.count).slice(0, 2);
    const peakShare = totalReqByHour
      ? Math.round((topHours.reduce((s, v) => s + v.count, 0) / totalReqByHour) * 100)
      : 0;
    const peakDow = [...byDow].sort((a, b) => b.count - a.count)[0]?.name;

    // What-if: 피크 2시간 슬롯 20% 증설
    const deltaDone = Math.max(1, Math.round(cur.cmp * 0.2 * (peakShare / 100)));
    const deltaSales = deltaDone * arpb;
    const monthProjection = Math.round(deltaSales * 4); // 4주 환산

    return {
      cur,
      prv,
      convReq2Cfm,
      convCfm2Cmp,
      convReq2Cmp,
      salesSum,
      arpb,
      top1,
      topShare,
      top3Share,
      topHours,
      peakShare,
      peakDow,
      deltaDone,
      deltaSales,
      monthProjection,
    };
  }, [series, seriesPrev, topPkg, byHour, byDow]);

  // 자동 요약 멘트(관리자 친화 용어)
  const insight = useMemo(() => {
    const {
      cur,
      prv,
      convReq2Cfm,
      convCfm2Cmp,
      convReq2Cmp,
      arpb,
      top1,
      topShare,
      top3Share,
      peakDow,
      topHours,
      peakShare,
      deltaDone,
      deltaSales,
      monthProjection,
    } = calc;

    const summary =
      `선택 기간 실적: 예약신청 ${fmt(cur.req)}건(${fmtDelta(cur.req, prv.req)}), ` +
      `예약확정 ${fmt(cur.cfm)}건(${fmtDelta(cur.cfm, prv.cfm)}), ` +
      `검진완료 ${fmt(cur.cmp)}건(${fmtDelta(cur.cmp, prv.cmp)}). ` +
      `신청→확정 ${convReq2Cfm}%, 확정→완료 ${convCfm2Cmp}%, 전체 성사율(신청→완료) ${convReq2Cmp}%.`;

    const sales =
      top1
        ? `매출 상위 상품은 ‘${top1.name}’이며 전체 매출의 ${topShare}%를 차지합니다(Top3 집중도 ${top3Share}%). ` +
          `완료 1건당 평균 매출은 약 ${fmt(arpb)}원입니다.`
        : `매출 상위 상품을 도출할 데이터가 부족합니다.`;

    const ops =
      peakDow && topHours.length
        ? `예약이 가장 몰리는 시간대는 ‘${peakDow}’의 ${topHours.map((h) => h.name).join("·")}이며, 이 2시간이 전체 신청의 약 ${peakShare}%입니다.`
        : `예약 집중 시간대를 도출할 데이터가 부족합니다.`;

    const proposals: string[] = [
      peakDow && topHours.length
        ? `피크 시간대(‘${peakDow}’ ${topHours.map((h) => h.name).join("·")}) 슬롯을 20% 증설하면 완료 약 ${fmt(
            deltaDone,
          )}건, 매출 약 ${fmt(deltaSales)}원 증가 예상. 동일 전략을 4주 유지 시 월 추가 ${fmt(monthProjection)}원 수준.`
        : "피크 시간대 파악 후 해당 시간 슬롯 증설과 상담 인력 집중 배치를 검토하십시오.",
      top1
        ? `상위 상품(‘${top1.name}’)에 ‘가장 많이 선택’ 배지와 묶음(예: 위·대장 패키지) 업셀을 적용해 평균 매출을 끌어올리십시오.`
        : "상위 상품을 정의하고 배지/업셀 전략을 적용하십시오.",
      "상위 고객사 대상 전월 실적 리포트 발송 + 재계약 리마인드 캠페인을 운영하십시오.",
      convReq2Cfm < 60
        ? `신청→확정 전환율(${convReq2Cfm}%) 개선 필요. ‘신청 10분 내 연락·30분 내 확정’ 같은 상담 목표를 세우고 알림을 활성화하십시오.`
        : `신청→확정 전환율이 양호합니다. 피크 시간에 상담 인력을 집중 배치해 추가 개선을 노리십시오.`,
      convCfm2Cmp < 75
        ? `확정→완료 전환율(${convCfm2Cmp}%) 개선 여지. 전날 안내문(준비물/오시는 길/주차)을 자동 발송하고 노쇼 방지 정책을 검토하십시오.`
        : `완료 전환율이 좋습니다. 고가 상품에 대한 사전 안내를 강화해 매출을 추가로 끌어올리십시오.`,
    ];

    return { summary, sales, ops, proposals };
  }, [calc]);

  return (
    <div id="report-root" className="mx-auto max-w-[1200px] p-6 print:p-0">
      {/* 화면 툴바 */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div className="text-xl font-semibold text-slate-900">대시보드 요약 보고서</div>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          onClick={() => window.print()}
          aria-label="인쇄 또는 PDF 저장"
        >
          인쇄 / PDF 저장
        </button>
      </div>

      {/* 기간 선택(화면에서만) */}
      <div className="mb-3 flex items-center justify-between print:mb-0 print:hidden">
        <div className="text-sm text-slate-600">생성일시: {nowText}</div>
        <WidgetToolbar
          storageKey="ms:report"
          syncGroup="report"
          onChange={(from, to) => setRange({ from, to })}
          defaultPreset={7}
          allowCustom
          note="신청일 기준"
        />
      </div>

      {/* === Sheet 1 === */}
      <section className="report-sheet">
        <div className="report-card">
          <div className="mb-2 text-base font-semibold text-slate-900">요약</div>
          <p className="text-sm leading-6 text-slate-800">{insight.summary}</p>
          <p className="text-sm leading-6 text-slate-800">{insight.sales}</p>
          <p className="text-sm leading-6 text-slate-800">{insight.ops}</p>
          <div className="mt-3 text-sm">
            <div className="mb-1 font-medium text-slate-900">실행 제안(영업·운영)</div>
            <ul className="list-disc space-y-1 pl-5 text-slate-800">
              {insight.proposals.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 핵심 지표 */}
        <div className="report-grid">
          {[
            { label: "예약신청", val: kpi?.requested ?? 0 },
            { label: "예약확정", val: kpi?.confirmed ?? 0 },
            { label: "예약변경", val: kpi?.amended ?? 0 },
            { label: "검진완료", val: kpi?.completed ?? 0 },
          ].map((b) => (
            <div key={b.label} className="report-card">
              <div className="text-sm text-slate-500">{b.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{(b.val || 0).toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* 전환 지표 */}
        <div className="report-grid">
          {[
            { label: "신청→확정 전환율", val: `${calc.convReq2Cfm}%` },
            { label: "확정→완료 전환율", val: `${calc.convCfm2Cmp}%` },
            { label: "신청→완료 성사율", val: `${calc.convReq2Cmp}%` },
            { label: "완료 1건당 평균 매출", val: `${fmt(calc.arpb)}원` },
          ].map((b) => (
            <div key={b.label} className="report-card">
              <div className="text-sm text-slate-500">{b.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{b.val}</div>
            </div>
          ))}
        </div>

        <div className="report-card">
          <div className="mb-2 text-base font-semibold text-slate-900">일자별 추세</div>
          <TrendChart data={series} height={360} />
          <div className="mt-2 text-[11px] text-slate-500">범례: 신청(파랑)·확정(초록)·변경(주황)·완료(빨강).</div>
        </div>
      </section>

      {/* === Sheet 2 === */}
      <section className="report-sheet">
        <div className="report-grid-2">
          <div className="report-card">
            <div className="mb-2 text-sm font-medium text-slate-800">성별 분포</div>
            <DonutChart data={sexData} nameKey="name" valueKey="value" height={260} />
          </div>
          <div className="report-card">
            <div className="mb-2 text-sm font-medium text-slate-800">연령 분포</div>
            <DonutChart data={ageData} nameKey="name" valueKey="value" height={260} />
          </div>
          <div className="report-card report-span-2">
            <div className="mb-2 text-sm font-medium text-slate-800">상위 패키지</div>
            <Bars
              data={topPkg}
              xKey="name"
              yKey="count"
              yName="건수"
              secondKey="amountKRW"
              secondName="매출(원)"
              height={300}
            />
            <div className="mt-2 text-[11px] text-slate-500">
              상위 패키지 집중도: Top1 {calc.topShare}% · Top3 {calc.top3Share}% / 총매출 {fmt(calc.salesSum)}원
            </div>
          </div>
        </div>
      </section>

      {/* === Sheet 3 === */}
      <section className="report-sheet">
        <div className="report-grid-2">
          <div className="report-card">
            <div className="mb-2 text-sm font-medium text-slate-800">요일별 신청</div>
            <Bars data={byDow} xKey="name" yKey="count" yName="건수" height={260} />
          </div>
          <div className="report-card">
            <div className="mb-2 text-sm font-medium text-slate-800">시간대별 신청</div>
            <Bars data={byHour} xKey="name" yKey="count" yName="건수" height={260} />
            {calc.topHours.length ? (
              <div className="mt-2 text-[11px] text-slate-500">
                피크 시간대: {calc.topHours.map((h) => h.name).join("·")} (집중도 {calc.peakShare}%)
              </div>
            ) : null}
          </div>
          <div className="report-card report-span-2">
            <div className="mb-2 text-sm font-medium text-slate-800">고객사별 매출 순위</div>
            <Bars
              data={topCompanies}
              xKey="name"
              yKey="amountKRW"
              yName="매출(원)"
              secondKey="count"
              secondName="건수"
              height={300}
            />
          </div>
        </div>
      </section>

      {/* === Print Styles (인쇄 영역은 유지) === */}
      <style jsx global>{`
        #report-root { background: #f8fafc; }
        .report-sheet {
          width: 100%;
          max-width: 210mm;
          margin: 0 auto 16px auto;
          padding: 12px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          break-inside: avoid;
        }
        .report-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 12px;
          break-inside: avoid;
        }
        .report-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .report-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .report-span-2 { grid-column: 1 / -1; }

        @media print {
          nav, aside, header, footer, .print\\:hidden { display: none !important; }
          body * { visibility: hidden !important; }
          #report-root, #report-root * { visibility: visible !important; }
          #report-root { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; }

          @page { size: A4; margin: 12mm; }

          .report-sheet { border: none !important; margin: 0 0 8mm 0 !important; page-break-after: always; }
          .report-card { padding: 10px; margin-bottom: 8px; }
          .report-grid { gap: 8px; }
          .report-grid-2 { gap: 8px; }

          svg text { font-size: 11px !important; }
        }
      `}</style>
    </div>
  );
}




