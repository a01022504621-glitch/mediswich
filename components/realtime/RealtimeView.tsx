"use client";

import { useEffect, useMemo, useState } from "react";
import TodayModal from "./TodayModal";
import SummaryQuickCard from "./SummaryQuickCard";
import FiltersBar from "./FiltersBar";
import ResultsTable, { RealtimeRow } from "./ResultsTable";

export type DateType = "전체" | "예약신청일" | "예약희망일" | "예약확정일";
export type Grade = "전체" | "임직원" | "기타(가족포함)";
export type Status =
  | "전체"
  | "예약신청"
  | "예약확정"
  | "검진완료"
  | "취소"
  | "검진미실시";

export default function RealtimeView() {
  const thisYear = new Date().getFullYear();

  // filters
  const [year, setYear] = useState<number>(thisYear);
  const [dateType, setDateType] = useState<DateType>("예약신청일");
  const [from, setFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [target, setTarget] = useState<string>("");
  const [grade, setGrade] = useState<Grade>("전체");
  const [statusFilter, setStatusFilter] = useState<Status>("전체");

  const [rows, setRows] = useState<RealtimeRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 👉 API 붙이는 자리
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        // const res = await fetch(`/api/realtime?...`);
        // const data: RealtimeRow[] = await res.json();
        const data: RealtimeRow[] = []; // 초기엔 빈 배열
        if (!ignore) setRows(data);
      } catch (e) {
        console.error(e);
        if (!ignore) setRows([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [year, dateType, from, to, target, grade, statusFilter]);

  // 클라 필터(백엔드 필터와 중복 가능)
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (grade !== "전체" && r.grade !== grade) return false;
      if (statusFilter !== "전체" && r.status !== statusFilter) return false;
      if (target && !`${r.patientName}${r.customer}`.includes(target)) return false;
      return true;
    });
  }, [rows, grade, statusFilter, target]);

  // 집계
  const counts = useMemo(() => {
    const base = { 예약신청: 0, 예약확정: 0, 검진완료: 0, 취소: 0, 검진미실시: 0 };
    filtered.forEach((r) => {
      if (r.status in base) (base as any)[r.status] += 1;
    });
    return base;
  }, [filtered]);

  // CSV 다운로드
  const handleDownload = () => {
    const header = [
      "No","고객사","수검자명","등급","생년월일","검진희망일","예약상태",
      "패키지타입","특수검진","특수물질","보건증","회사지원금","본인부담금","예약신청일",
    ];
    const lines = filtered.map((r, idx) => [
      idx + 1, r.customer, r.patientName, r.grade, r.birthDate, r.preferredDate, r.status,
      r.packageType, r.specialExam ? "Y" : "N", r.specialMaterial ? "Y" : "N", r.healthCert ? "Y" : "N",
      r.companySupport?.toLocaleString() ?? "0", r.selfPay?.toLocaleString() ?? "0", r.appliedAt,
    ]);
    const csv = [header, ...lines]
      .map(row => row.map(c => `"${String(c ?? "").replace(/"/g,'""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([new TextEncoder().encode(csv)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0,10).replace(/-/g,"");
    a.href = url; a.download = `실시간_검진현황_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <TodayModal rows={rows} />

      <div className="grid grid-cols-12 gap-6">
        {/* 좌측: 검색 + 테이블 */}
        <section className="col-span-12 xl:col-span-8 space-y-4">
          <div className="card glass">
            <div className="card-inner">
              <div className="text-sm font-semibold mb-4">검색 · 조회</div>
              <FiltersBar
                year={year} setYear={setYear}
                dateType={dateType} setDateType={setDateType}
                from={from} to={to} setFrom={setFrom} setTo={setTo}
                target={target} setTarget={setTarget}
                grade={grade} setGrade={setGrade}
                onDownload={handleDownload}
                loading={loading}
                compactLayout // 👉 줄 배치 옵션
              />
            </div>
          </div>

          <ResultsTable
            rows={filtered}
            loading={loading}
            statusFilter={statusFilter}
            setStatusFilter={(v) => setStatusFilter(v as Status)}
          />
        </section>

        {/* 우측: 하나의 카드 안에 요약 */}
        <aside className="col-span-12 xl:col-span-4">
          <SummaryQuickCard
            counts={counts}
            total={filtered.length}
            onPickStatus={(s) => setStatusFilter(s as Status)}
          />
        </aside>
      </div>
    </div>
  );
}


