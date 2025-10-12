"use client";

import React, { useMemo, useState } from "react";

// 상태 타입
type Status = "예약신청" | "예약확정" | "검진완료" | "취소" | "검진미실시";
const STATUS_ORDER: Status[] = ["예약신청", "예약확정", "검진완료", "취소", "검진미실시"];
const STATUS_DOT: Record<Status, string> = {
  예약신청: "bg-blue-500",
  예약확정: "bg-rose-500",
  검진완료: "bg-emerald-500",
  취소: "bg-gray-500",
  검진미실시: "bg-amber-500",
};

type Row = {
  id: string;
  고객사: string;
  수검자명: string;
  등급: string;            // 임직원/기타
  생년월일: string;        // YYYY-MM-DD
  검진희망일: string;      // YYYY-MM-DD
  예약상태: Status;
  패키지타입: string;
  특수검진: string;
  특수물질: string;
  보건증: string;          // Y/N
  회사지원금: number;
  본인부담금: number;
  예약신청일: string;      // YYYY-MM-DD
};

// 샘플(빈 데이터로 시작)
const MOCK_ROWS: Row[] = [];

export default function RealtimePage() {
  // ── 검색 폼 상태
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const today = `${yyyy}-${mm}-${dd}`;

  const minYear = 2025;
  const [검진연도, set검진연도] = useState<number>(Math.max(minYear, yyyy));
  const [조회구분, set조회구분] = useState<"전체" | "예약신청일" | "예약희망일" | "예약확정일">("예약신청일");
  const [기간From, set기간From] = useState<string>(today);
  const [기간To, set기간To] = useState<string>(today);
  const [고객등급, set고객등급] = useState<"전체" | "임직원" | "기타">("전체");
  const [검진대상자, set검진대상자] = useState<string>("");

  // ── 목록/선택/페이징
  const [rows, setRows] = useState<Row[]>(MOCK_ROWS);
  const [statusFilter, setStatusFilter] = useState<"전체" | Status>("전체");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // ── 필터링/검색 (실서비스에서는 서버쿼리로 교체)
  const filtered = useMemo(() => {
    let r = [...rows];

    // 상태 필터
    if (statusFilter !== "전체") {
      r = r.filter(x => x.예약상태 === statusFilter);
    }

    // 고객등급
    if (고객등급 !== "전체") r = r.filter(x => x.등급 === 고객등급);

    // 대상자 검색(이름/고객사 포함)
    const q = 검진대상자.trim();
    if (q) {
      r = r.filter(x =>
        x.수검자명.includes(q) ||
        x.고객사.includes(q)
      );
    }

    // 연도/기간 필터 (프론트 시연용)
    r = r.filter(x => Number(x.검진희망일.slice(0, 4)) >= minYear && Number(x.검진희망일.slice(0, 4)) <= yyyy);

    if (조회구분 !== "전체") {
      const field =
        조회구분 === "예약신청일" ? "예약신청일" :
        조회구분 === "예약확정일" ? "예약희망일" :
        "검진희망일"; // 예약희망일

      r = r.filter(x => {
        const d = (x as any)[field] as string;
        return d >= 기간From && d <= 기간To;
      });
    }

    return r;
  }, [rows, statusFilter, 고객등급, 검진대상자, 조회구분, 기간From, 기간To]);

  // 페이징
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // 요약(상태별 카운트)
  const counts = useMemo(() => {
    const base: Record<Status, number> = {
      예약신청: 0, 예약확정: 0, 검진완료: 0, 취소: 0, 검진미실시: 0
    };
    for (const r of filtered) base[r.예약상태]++;
    const totalAll = filtered.length;
    return { ...base, totalAll };
  }, [filtered]);

  // 전체선택
  const allChecked = pageRows.length > 0 && pageRows.every(r => selectedIds.has(r.id));
  const toggleAll = (checked: boolean) => {
    const copy = new Set(selectedIds);
    for (const r of pageRows) {
      checked ? copy.add(r.id) : copy.delete(r.id);
    }
    setSelectedIds(copy);
  };
  const toggleOne = (id: string, checked: boolean) => {
    const copy = new Set(selectedIds);
    checked ? copy.add(id) : copy.delete(id);
    setSelectedIds(copy);
  };

  // 일괄 상태 변경(프론트 시연용 – 실제 업데이트는 API 연동)
  const [bulkStatus, setBulkStatus] = useState<Status>("예약신청");
  const applyBulkChange = () => {
    if (selectedIds.size === 0) return;
    setRows(prev =>
      prev.map(r => selectedIds.has(r.id) ? { ...r, 예약상태: bulkStatus } : r)
    );
    setSelectedIds(new Set());
  };

  // 엑셀(CSV) 다운로드 – 현재 필터 적용된 전체 목록 저장
  const exportCSV = () => {
    const header = [
      "고객사","수검자명","등급","생년월일","검진희망일","예약상태",
      "패키지타입","특수검진","특수물질","보건증","회사지원금","본인부담금","예약신청일"
    ];
    const lines = filtered.map(r => [
      r.고객사, r.수검자명, r.등급, r.생년월일, r.검진희망일, r.예약상태,
      r.패키지타입, r.특수검진, r.특수물질, r.보건증, r.회사지원금, r.본인부담금, r.예약신청일
    ].map(v => `"${String(v).replaceAll(`"`, `""`)}"`).join(","));
    const csv = [header.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `realtime_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // 요약 아이템 클릭 → 상태 필터
  const clickSummary = (s: "전체" | Status) => {
    setStatusFilter(s);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 검색/요약 한 카드 (유리막) */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-md shadow-lg">
        <div className="grid grid-cols-3 gap-8 p-6">
          {/* 왼쪽 2/3 : 검색 */}
          <section className="col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">검색 · 조회</h3>

            {/* 1줄: 검진연도 */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs text-slate-500 mb-1">검진연도</label>
                <select
                  value={검진연도}
                  onChange={(e) => set검진연도(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {Array.from({length: yyyy - minYear + 1}).map((_,i)=>{
                    const y = minYear + i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>

              {/* 2줄: 조회구분 + 기간 */}
              <div className="col-span-12 md:col-span-6" />
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">조회구분</label>
                <select
                  value={조회구분}
                  onChange={(e)=>set조회구분(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option>전체</option>
                  <option>예약신청일</option>
                  <option>예약희망일</option>
                  <option>예약확정일</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">기간(From)</label>
                <input
                  type="date"
                  value={기간From}
                  onChange={(e)=>set기간From(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-6 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">기간(To)</label>
                <input
                  type="date"
                  value={기간To}
                  onChange={(e)=>set기간To(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              {/* 3줄: 고객등급 */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">고객등급</label>
                <select
                  value={고객등급}
                  onChange={(e)=>set고객등급(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option>전체</option>
                  <option>임직원</option>
                  <option>기타</option>
                </select>
              </div>

              {/* 4줄: 검진대상자 */}
              <div className="col-span-12 md:col-span-8">
                <label className="block text-xs text-slate-500 mb-1">검진대상자</label>
                <input
                  value={검진대상자}
                  onChange={(e)=>set검진대상자(e.target.value)}
                  placeholder="이름/고객사 등 검색"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          {/* 오른쪽 1/3 : 빠른 요약 */}
          <aside className="col-span-3 md:col-span-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">진행 현황</h3>
              <div className="text-sm font-semibold text-slate-900">
                {counts.totalAll.toLocaleString()}<span className="text-slate-500 text-xs"> 건</span>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              <li>
                <button
                  onClick={()=>clickSummary("예약신청")}
                  className="w-full rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 py-2.5 px-3 text-left shadow-sm transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT["예약신청"]}`} />
                      <span className="text-sm">예약신청</span>
                    </span>
                    <span className="text-sm font-semibold">{counts["예약신청"]}건</span>
                  </div>
                </button>
              </li>
              <li>
                <button onClick={()=>clickSummary("예약확정")} className="w-full rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 py-2.5 px-3 text-left shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT["예약확정"]}`} /><span className="text-sm">예약확정</span></span>
                    <span className="text-sm font-semibold">{counts["예약확정"]}건</span>
                  </div>
                </button>
              </li>
              <li>
                <button onClick={()=>clickSummary("검진완료")} className="w-full rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 py-2.5 px-3 text-left shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT["검진완료"]}`} /><span className="text-sm">검진완료</span></span>
                    <span className="text-sm font-semibold">{counts["검진완료"]}건</span>
                  </div>
                </button>
              </li>
              <li>
                <button onClick={()=>clickSummary("취소")} className="w-full rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 py-2.5 px-3 text-left shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT["취소"]}`} /><span className="text-sm">취소</span></span>
                    <span className="text-sm font-semibold">{counts["취소"]}건</span>
                  </div>
                </button>
              </li>
              <li>
                <button onClick={()=>clickSummary("검진미실시")} className="w-full rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 py-2.5 px-3 text-left shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT["검진미실시"]}`} /><span className="text-sm">검진미실시</span></span>
                    <span className="text-sm font-semibold">{counts["검진미실시"]}건</span>
                  </div>
                </button>
              </li>
            </ul>

            <div className="mt-2 text-[11px] text-slate-500">• 항목을 클릭하면 해당 상태로 필터됩니다.</div>
          </aside>
        </div>
      </div>

      {/* 명단 카드 */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        {/* 헤더: 상태필터 + 일괄변경 + 엑셀버튼 */}
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between border-b">
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">상태 필터</div>
            <select
              value={statusFilter}
              onChange={(e)=>{ setStatusFilter(e.target.value as any); setPage(1); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="전체">전체</option>
              {STATUS_ORDER.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
            {/* 일괄 변경 */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">선택 {selectedIds.size}명</span>
              <select
                value={bulkStatus}
                onChange={(e)=>setBulkStatus(e.target.value as Status)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
              >
                {STATUS_ORDER.map(s=><option key={s}>{s}</option>)}
              </select>
              <button
                onClick={applyBulkChange}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                적용
              </button>
            </div>

            {/* 엑셀 버튼(초록) */}
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              title="엑셀(CSV) 다운로드"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h10a2 2 0 0 1 2 2v2h4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" stroke="#059669" strokeWidth="1.6"/><path d="M9 12l-3 5m0-5l3 5" stroke="#059669" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 4v4h4" stroke="#059669" strokeWidth="1.6"/></svg>
              엑셀 다운로드
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b">
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e)=>toggleAll(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-3 w-14 text-left">No</th>
                <th className="px-3 py-3 text-left">고객사</th>
                <th className="px-3 py-3 text-left">수검자명</th>
                <th className="px-3 py-3 text-left">등급</th>
                <th className="px-3 py-3 text-left">생년월일</th>
                <th className="px-3 py-3 text-left">검진희망일</th>
                <th className="px-3 py-3 text-left">예약상태</th>
                <th className="px-3 py-3 text-left">패키지타입</th>
                <th className="px-3 py-3 text-left">특수검진</th>
                <th className="px-3 py-3 text-left">특수물질</th>
                <th className="px-3 py-3 text-left">보건증</th>
                <th className="px-3 py-3 text-right">회사지원금</th>
                <th className="px-3 py-3 text-right">본인부담금</th>
                <th className="px-3 py-3 text-left">예약신청일</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-16 text-center text-slate-500">데이터가 없습니다.</td>
                </tr>
              )}
              {pageRows.map((r, idx) => (
                <tr key={r.id} className="border-b hover:bg-slate-50/80">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={(e)=>toggleOne(r.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">{(page-1)*pageSize + idx + 1}</td>
                  <td className="px-3 py-2">{r.고객사}</td>
                  <td className="px-3 py-2">{r.수검자명}</td>
                  <td className="px-3 py-2">{r.등급}</td>
                  <td className="px-3 py-2">{r.생년월일}</td>
                  <td className="px-3 py-2">{r.검진희망일}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[r.예약상태]}`} />
                      {r.예약상태}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.패키지타입}</td>
                  <td className="px-3 py-2">{r.특수검진}</td>
                  <td className="px-3 py-2">{r.특수물질}</td>
                  <td className="px-3 py-2">{r.보건증}</td>
                  <td className="px-3 py-2 text-right">{r.회사지원금.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{r.본인부담금.toLocaleString()}</td>
                  <td className="px-3 py-2">{r.예약신청일}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        <div className="flex items-center justify-center gap-6 p-4">
          <button
            className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40"
            onClick={()=>setPage(p=>Math.max(1, p-1))}
            disabled={page<=1}
          >
            이전
          </button>
          <div className="text-sm text-slate-700">
            {page} / {totalPages}
          </div>
          <button
            className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40"
            onClick={()=>setPage(p=>Math.min(totalPages, p+1))}
            disabled={page>=totalPages}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
