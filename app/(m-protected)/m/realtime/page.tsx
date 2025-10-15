// 경로: mediswich/app/(m-protected)/m/realtime/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** 상태 */
type Status = "예약신청" | "예약확정" | "검진완료" | "취소" | "검진미실시";
const STATUS_ORDER: Status[] = ["예약신청", "예약확정", "검진완료", "취소", "검진미실시"];
const STATUS_DOT: Record<Status, string> = {
  예약신청: "bg-blue-500",
  예약확정: "bg-rose-500",
  검진완료: "bg-emerald-500",
  취소: "bg-gray-500",
  검진미실시: "bg-amber-500",
};
const toEN = (s: Status) =>
  s === "예약신청" ? "PENDING" :
  s === "예약확정" ? "CONFIRMED" :
  s === "검진완료" ? "COMPLETED" :
  s === "취소" ? "CANCELED" : "NO_SHOW";

/** Row */
type Row = {
  id: string;
  고객사: string;
  수검자명: string;
  등급: string;
  생년월일: string;
  휴대폰번호?: string;
  이메일?: string;
  주소?: string;
  예약희망일: string;
  예약확정일?: string;
  검진완료일?: string;
  예약상태: Status;
  패키지타입: string;
  선택검사A?: string;
  선택검사B?: string;
  검사코드?: string;
  특수검진: string;
  특수물질: string;
  보건증: string;
  회사지원금: number;
  본인부담금: number;
  복용약?: string;
  병력?: string;
  예약신청일: string;
};

export default function RealtimePage() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const today = `${yyyy}-${mm}-${dd}`;

  const [검진연도, set검진연도] = useState<number>(yyyy);
  const [조회구분, set조회구분] = useState<"전체" | "예약신청일" | "예약희망일" | "예약확정일" | "검진완료일">("예약신청일");
  const [기간From, set기간From] = useState<string>(today);
  const [기간To, set기간To] = useState<string>(today);

  const [고객사Sel, set고객사Sel] = useState<string>("전체");
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  const [고객등급, set고객등급] = useState<"전체" | "임직원" | "기타">("전체");
  const [검진대상자, set검진대상자] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState<"전체" | Status>("전체");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  /** 팝업 상태 */
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [editStatus, setEditStatus] = useState<Status>("예약신청"); // 표시용. 비활성
  const [editConfirmed, setEditConfirmed] = useState<string | undefined>(undefined);
  const [editCompleted, setEditCompleted] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  /** 일괄변경 UI 상태 */
  const [bulkStatus, setBulkStatus] = useState<Status>("예약확정");

  /** 고객사 목록 로드(ㄱㄴㄷ 정렬) */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/clients/options", { cache: "no-store" });
        const j = await r.json();
        const items: Array<{ id: string; name: string }> = Array.isArray(j?.items) ? j.items : [];
        const sorted = items.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
        setClients(sorted);
      } catch {
        setClients([]);
      }
    })();
  }, []);

  /** 데이터 로드 */
  const fetchList = () => {
    const q = new URLSearchParams({ year: String(검진연도), from: 기간From, to: 기간To });
    fetch(`/api/m/realtime?${q.toString()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => setRows(Array.isArray(j?.items) ? j.items : []))
      .catch(() => setRows([]));
  };
  useEffect(() => {
    fetchList();
    setSelectedIds(new Set());
    setPage(1);
  }, [검진연도, 기간From, 기간To]);

  /** 필터링 */
  const filtered = useMemo(() => {
    let r = [...rows];
    if (statusFilter !== "전체") r = r.filter(x => x.예약상태 === statusFilter);
    if (고객등급 !== "전체") r = r.filter(x => x.등급 === 고객등급);
    if (고객사Sel !== "전체") r = r.filter(x => x.고객사 === 고객사Sel);

    const nameQ = 검진대상자.trim();
    if (nameQ) r = r.filter(x => x.수검자명.includes(nameQ));

    if (조회구분 !== "전체") {
      const field =
        조회구분 === "예약신청일" ? "예약신청일" :
        조회구분 === "예약희망일" ? "예약희망일" :
        조회구분 === "예약확정일" ? "예약확정일" : "검진완료일";
      r = r.filter(x => {
        const d = (x as any)[field] as string | undefined;
        if (!d) return false;
        return d >= 기간From && d <= 기간To;
      });
    }
    return r;
  }, [rows, statusFilter, 고객등급, 고객사Sel, 검진대상자, 조회구분, 기간From, 기간To]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const counts = useMemo(() => {
    const base: Record<Status, number> = { 예약신청: 0, 예약확정: 0, 검진완료: 0, 취소: 0, 검진미실시: 0 };
    for (const r of filtered) base[r.예약상태]++;
    return { ...base, totalAll: filtered.length };
  }, [filtered]);

  /** 선택 토글 */
  const allChecked = pageRows.length > 0 && pageRows.every(r => selectedIds.has(r.id));
  const toggleAll = (checked: boolean) => {
    const copy = new Set(selectedIds);
    for (const r of pageRows) checked ? copy.add(r.id) : copy.delete(r.id);
    setSelectedIds(copy);
  };
  const toggleOne = (id: string, checked: boolean) => {
    const copy = new Set(selectedIds);
    checked ? copy.add(id) : copy.delete(id);
    setSelectedIds(copy);
  };

  /** 엑셀 다운로드 */
  const exportSelected = async () => {
    if (selectedIds.size === 0) {
      alert("다운로드할 인원을 선택하세요.");
      return;
    }
    const ids = Array.from(selectedIds).join(",");
    const url = `/api/m/realtime/export?ids=${encodeURIComponent(ids)}`;
    window.open(url, "_blank");
  };

  /** 요약 클릭 */
  const clickSummary = (s: "전체" | Status) => { setStatusFilter(s); setPage(1); };

  /** 행 클릭 → 팝업 */
  const handleRowClick = (row: Row) => {
    setSelectedRow(row);
    setEditStatus(row.예약상태);
    setEditConfirmed(row.예약확정일 || undefined);
    setEditCompleted(row.검진완료일 || undefined);
  };

  /** 단건 저장 */
  const saveDetail = async () => {
    if (!selectedRow) return;

    if (editCompleted && !editConfirmed) {
      alert("예약확정 전 인원입니다. 검진완료 처리 불가능합니다. 예약확정 처리 먼저 해주세요.");
      return;
    }

    const updates: any[] = [];
    if (editCompleted) {
      const ok = confirm(`${editCompleted} 검진완료 처리합니다. 진행할까요?`);
      if (!ok) return;
      updates.push({ id: selectedRow.id, status: "COMPLETED", completedDate: editCompleted });
    } else if (editConfirmed) {
      const ok = confirm(`${editConfirmed} 예약확정 처리합니다. 진행할까요?`);
      if (!ok) return;
      updates.push({ id: selectedRow.id, status: "CONFIRMED", confirmedDate: editConfirmed });
    } else {
      alert("변경할 날짜가 없습니다.");
      return;
    }

    setSaving(true);
    try {
      const r = await fetch("/api/m/realtime/batch-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "저장 실패");
      }
      await fetchList();
      setSelectedRow(null);
    } catch (e: any) {
      alert(e?.message || e);
    } finally {
      setSaving(false);
    }
  };

  /** 일괄 변경 */
  const bulkApply = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert("변경할 인원을 선택하세요.");
      return;
    }
    const pool = rows.filter(r => ids.includes(r.id));

    if (bulkStatus === "예약확정") {
      const baseMsg = `선택 ${ids.length}건을 예약확정 처리합니다.\n확정일 = 각 건의 '예약희망일'을 사용합니다.`;
      if (!confirm(baseMsg)) return;

      const already = pool.filter(r => !!r.예약확정일).length;
      if (already > 0) {
        alert(`현재 예약확정 인원 ${already}건은 제외하고, 예약신청 인원만 예약확정 처리합니다.`);
      }
      const updates = pool
        .filter(r => !r.예약확정일 && !!r.예약희망일)
        .map(r => ({ id: r.id, status: "CONFIRMED", confirmedDate: r.예약희망일 }));

      if (!updates.length) {
        alert("변경할 항목이 없습니다.");
        return;
      }
      await postUpdates(updates);
    } else if (bulkStatus === "검진완료") {
      const baseMsg = `선택 ${ids.length}건을 검진완료 처리합니다.\n완료일 = 각 건의 '예약확정일'을 사용합니다.`;
      if (!confirm(baseMsg)) return;

      const already = pool.filter(r => !!r.검진완료일).length;
      if (already > 0) {
        alert(`이미 검진완료 인원 ${already}건은 제외하고, 미완료 인원만 검진완료 처리합니다.`);
      }
      const updates = pool
        .filter(r => !!r.예약확정일 && !r.검진완료일)
        .map(r => ({ id: r.id, status: "COMPLETED", completedDate: r.예약확정일! }));

      if (!updates.length) {
        alert("변경할 항목이 없습니다.");
        return;
      }
      await postUpdates(updates);
    } else {
      alert("일괄변경은 '예약확정' 또는 '검진완료'만 지원합니다.");
    }
  };

  async function postUpdates(updates: any[]) {
    try {
      const r = await fetch("/api/m/realtime/batch-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "일괄 변경 실패");
      }
      await fetchList();
      setSelectedIds(new Set());
    } catch (e: any) {
      alert(e?.message || e);
    }
  }

  /** 빠른 지정 */
  const quickPick = async (row: Row, kind: "CONFIRMED" | "COMPLETED", date: string) => {
    if (kind === "COMPLETED" && !row.예약확정일) {
      alert("예약확정 전 인원입니다. 검진완료 처리 불가능합니다. 예약확정 처리 먼저 해주세요.");
      return;
    }
    const msg = kind === "CONFIRMED" ? `${date} 예약확정 처리합니다. 진행할까요?` : `${date} 검진완료 처리합니다. 진행할까요?`;
    if (!confirm(msg)) return;

    const body = kind === "CONFIRMED"
      ? { updates: [{ id: row.id, status: "CONFIRMED", confirmedDate: date }] }
      : { updates: [{ id: row.id, status: "COMPLETED", completedDate: date }] };

    const r = await fetch("/api/m/realtime/batch-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j?.error || "저장 실패");
      return;
    }
    fetchList();
  };

  return (
    <div className="space-y-6">
      {/* 검색/요약 */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-md shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6">
          <section className="col-span-1 md:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">검색 · 조회</h3>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs text-slate-500 mb-1">검진연도</label>
                <select value={검진연도} onChange={(e) => set검진연도(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = yyyy - 2 + i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
              <div className="col-span-12 md:col-span-6" />

              {/* 조회구분 */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">조회구분</label>
                <select value={조회구분} onChange={(e) => set조회구분(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option>전체</option>
                  <option>예약신청일</option>
                  <option>예약희망일</option>
                  <option>예약확정일</option>
                  <option>검진완료일</option>
                </select>
              </div>

              {/* 기간 From */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">기간(From)</label>
                <input type="date" value={기간From} onChange={(e) => set기간From(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>

              {/* 기간 To */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">기간(To)</label>
                <input type="date" value={기간To} onChange={(e) => set기간To(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>

              {/* 고객사 */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">고객사</label>
                <select
                  value={고객사Sel}
                  onChange={(e) => set고객사Sel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="전체">전체</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 고객등급 */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">고객등급</label>
                <select value={고객등급} onChange={(e) => set고객등급(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option>전체</option><option>임직원</option><option>기타</option>
                </select>
              </div>

              {/* 수검자명 */}
              <div className="col-span-12 md:col-span-8">
                <label className="block text-xs text-slate-500 mb-1">검진대상자</label>
                <input value={검진대상자} onChange={(e) => set검진대상자(e.target.value)} placeholder="수검자명 검색" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
            </div>
          </section>

          <aside className="col-span-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">진행 현황</h3>
              <div className="text-sm font-semibold text-slate-900">{counts.totalAll.toLocaleString()}<span className="text-slate-500 text-xs"> 건</span></div>
            </div>
            <ul className="mt-3 space-y-2">
              {STATUS_ORDER.map(s => (
                <li key={s}>
                  <button onClick={() => clickSummary(s)} className="w-full rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 py-2.5 px-3 text-left shadow-sm transition">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} /><span className="text-sm">{s}</span></span>
                      <span className="text-sm font-semibold">{(counts as any)[s]}건</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[11px] text-slate-500">• 항목을 클릭하면 해당 상태로 필터됩니다.</div>
          </aside>
        </div>
      </div>

      {/* 명단 + 액션바 */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between border-b">
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">상태 필터</div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="전체">전체</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
            {/* 일괄 변경 컨트롤 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">선택 {selectedIds.size}건</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as Status)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                title="일괄 상태"
              >
                <option value="예약확정">예약확정</option>
                <option value="검진완료">검진완료</option>
              </select>
              <button
                onClick={bulkApply}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                title="선택 일괄 상태 변경"
              >
                일괄 변경
              </button>
            </div>

            <button onClick={exportSelected} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100" title="선택 인원 엑셀 다운로드">
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
                <th className="px-3 py-3 w-10 text-center"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
                <th className="px-3 py-3 w-14 text-left">No</th>
                <th className="px-3 py-3 text-left">고객사</th>
                <th className="px-3 py-3 text-left">수검자명</th>
                <th className="px-3 py-3 text-left">등급</th>
                <th className="px-3 py-3 text-left">생년월일</th>
                <th className="px-3 py-3 text-left">예약희망일</th>
                <th className="px-3 py-3 text-left">예약확정일</th>
                <th className="px-3 py-3 text-left">검진완료일</th>
                <th className="px-3 py-3 text-left">예약상태</th>
                <th className="px-3 py-3 text-left">패키지타입</th>
                <th className="px-3 py-3 text-right">회사지원금</th>
                <th className="px-3 py-3 text-right">본인부담금</th>
                <th className="px-3 py-3 text-left">예약신청일</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={16} className="py-16 text-center text-slate-500">데이터가 없습니다.</td></tr>
              )}
              {pageRows.map((r, idx) => (
                <tr key={r.id} onClick={() => handleRowClick(r)} className="border-b hover:bg-slate-50/80 cursor-pointer">
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={(e) => toggleOne(r.id, e.target.checked)} />
                  </td>
                  <td className="px-3 py-2">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2">{r.고객사}</td>
                  <td className="px-3 py-2">{r.수검자명}</td>
                  <td className="px-3 py-2">{r.등급}</td>
                  <td className="px-3 py-2">{r.생년월일}</td>
                  <td className="px-3 py-2">{r.예약희망일}</td>

                  {/* 예약확정일 셀 */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <DateCell
                      value={r.예약확정일}
                      placeholder="지정"
                      onPick={(d) => quickPick(r, "CONFIRMED", d)}
                      title="예약확정일 지정"
                    />
                  </td>

                  {/* 검진완료일 셀 */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <DateCell
                      value={r.검진완료일}
                      placeholder="지정"
                      onPick={(d) => quickPick(r, "COMPLETED", d)}
                      title="검진완료일 지정"
                    />
                  </td>

                  <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[r.예약상태]}`} />{r.예약상태}</span></td>
                  <td className="px-3 py-2">{r.패키지타입}</td>
                  <td className="px-3 py-2 text-right">{Number(r.회사지원금 || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{Number(r.본인부담금 || 0).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.예약신청일}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        <div className="flex items-center justify-center gap-6 p-4">
          <button className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>이전</button>
          <div className="text-sm text-slate-700">{page} / {totalPages}</div>
          <button className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>다음</button>
        </div>
      </div>

      {/* 상세 팝업 */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">예약 상세 정보</h3>
              <button onClick={() => setSelectedRow(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <InfoSection title="수검자 정보">
                <InfoRow label="고객사" value={selectedRow.고객사} />
                <InfoRow label="수검자명" value={selectedRow.수검자명} />
                <InfoRow label="생년월일" value={selectedRow.생년월일} />
                <InfoRow label="휴대폰번호" value={selectedRow.휴대폰번호} />
                <InfoRow label="이메일" value={selectedRow.이메일} />
                <InfoRow label="주소" value={selectedRow.주소} />
              </InfoSection>

              <InfoSection title="예약 정보">
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-slate-600 font-medium">예약상태</div>
                  <div className="col-span-2">
                    <select value={editStatus} disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">상태는 날짜 지정으로만 변경합니다.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-slate-600 font-medium">예약희망일</div>
                  <div className="col-span-2 text-slate-800">{selectedRow.예약희망일}</div>
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-slate-600 font-medium">예약확정일</div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={editConfirmed || ""}
                        onChange={(e) => setEditConfirmed(e.target.value || undefined)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      {editConfirmed && (
                        <button
                          type="button"
                          onClick={() => setEditConfirmed(undefined)}
                          className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-100"
                        >
                          지우기
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">확정 처리한 날짜가 아니라 실제 확정된 날짜를 지정합니다.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-slate-600 font-medium">검진완료일</div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={editCompleted || ""}
                        onChange={(e) => setEditCompleted(e.target.value || undefined)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      {editCompleted && (
                        <button
                          type="button"
                          onClick={() => setEditCompleted(undefined)}
                          className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-100"
                        >
                          지우기
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">예약확정 이후에만 지정 가능합니다.</p>
                  </div>
                </div>

                <InfoRow label="예약신청일" value={selectedRow.예약신청일} />
              </InfoSection>

              <InfoSection title="검진 정보">
                <InfoRow label="패키지타입" value={selectedRow.패키지타입} />
                <InfoRow label="선택검사 A" value={selectedRow.선택검사A} />
                <InfoRow label="선택검사 B" value={selectedRow.선택검사B} />
                <InfoRow label="검사코드" value={selectedRow.검사코드} />
                <InfoRow label="특수검진" value={selectedRow.특수검진} />
                <InfoRow label="특수물질" value={selectedRow.특수물질} />
                <InfoRow label="보건증" value={selectedRow.보건증} />
              </InfoSection>

              <InfoSection title="비용 정보">
                <InfoRow label="회사지원금" value={`${Number(selectedRow.회사지원금 || 0).toLocaleString()}원`} />
                <InfoRow label="본인부담금" value={`${Number(selectedRow.본인부담금 || 0).toLocaleString()}원`} />
              </InfoSection>

              <InfoSection title="문진 정보">
                <InfoRow label="복용약" value={selectedRow.복용약} />
                <InfoRow label="병력" value={selectedRow.병력} />
              </InfoSection>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedRow(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                disabled={saving}
              >
                닫기
              </button>
              <button
                onClick={saveDetail}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-slate-900 hover:opacity-90 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "저장중" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 날짜 셀: 값 없으면 버튼 아래 드롭다운 달력 */
function DateCell({ value, placeholder, onPick, title }: { value?: string; placeholder: string; onPick: (d: string) => void; title?: string }) {
  const [open, setOpen] = useState(false);
  const [tmp, setTmp] = useState<string>("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  if (value) return <span className="text-slate-800">{value}</span>;

  return (
    <div className="relative inline-block" ref={boxRef}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="#334155" strokeWidth="1.6"/><path d="M8 3v4M16 3v4M3 9h18" stroke="#334155" strokeWidth="1.6" strokeLinecap="round"/></svg>
        <span>{placeholder}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <input
            type="date"
            value={tmp}
            onChange={(e) => setTmp(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setTmp(""); setOpen(false); }} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-50">취소</button>
            <button
              type="button"
              onClick={() => { if (tmp) { onPick(tmp); setTmp(""); setOpen(false); } }}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 text-white hover:opacity-90"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 팝업 헬퍼 */
const InfoSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div>
    <h4 className="text-sm font-semibold text-slate-500 mb-2 pb-1 border-b">{title}</h4>
    <div className="space-y-1 text-sm">{children}</div>
  </div>
);
const InfoRow = ({ label, value }: { label: string, value?: string | number }) => (
  <div className="grid grid-cols-3 gap-4">
    <div className="text-slate-600 font-medium">{label}</div>
    <div className="col-span-2 text-slate-800">{value || "-"}</div>
  </div>
);




