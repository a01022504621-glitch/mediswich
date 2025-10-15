// 경로: mediswich/app/(m-protected)/m/realtime/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  const [조회구분, set조회구분] = useState<"전체" | "예약신청일" | "예약희망일" | "예약확정일">("예약신청일");
  const [기간From, set기간From] = useState<string>(today);
  const [기간To, set기간To] = useState<string>(today);
  const [고객등급, set고객등급] = useState<"전체" | "임직원" | "기타">("전체");
  const [검진대상자, set검진대상자] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState<"전체" | Status>("전체");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  /** 팝업 상태 */
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [editStatus, setEditStatus] = useState<Status>("예약신청");
  const [editConfirmed, setEditConfirmed] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  /** 일괄변경 UI 상태 */
  const [bulkStatus, setBulkStatus] = useState<Status>("예약확정");
  const [bulkConfirmed, setBulkConfirmed] = useState<string>("");

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
    const q = 검진대상자.trim();
    if (q) r = r.filter(x => x.수검자명.includes(q) || x.고객사.includes(q));
    if (조회구분 !== "전체") {
      const field = 조회구분 === "예약신청일" ? "예약신청일" : 조회구분 === "예약희망일" ? "예약희망일" : "예약확정일";
      r = r.filter(x => {
        const d = (x as any)[field] as string | undefined;
        if (!d) return false;
        return d >= 기간From && d <= 기간To;
      });
    }
    return r;
  }, [rows, statusFilter, 고객등급, 검진대상자, 조회구분, 기간From, 기간To]);

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
  };

  /** 단건 저장 */
  const saveDetail = async () => {
    if (!selectedRow) return;
    setSaving(true);
    try {
      const body = {
        updates: [
          {
            id: selectedRow.id,
            status: toEN(editStatus),
            confirmedDate: editConfirmed || null,
          },
        ],
      };
      const r = await fetch("/api/m/realtime/batch-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    const ok = confirm(`선택 ${ids.length}건을 "${bulkStatus}" 상태로 변경합니다.`);
    if (!ok) return;
    try {
      const body = {
        updates: ids.map(id => ({
          id,
          status: toEN(bulkStatus),
          confirmedDate: bulkConfirmed || null,
        })),
      };
      const r = await fetch("/api/m/realtime/batch-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">조회구분</label>
                <select value={조회구분} onChange={(e) => set조회구분(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option>전체</option><option>예약신청일</option><option>예약희망일</option><option>예약확정일</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">기간(From)</label>
                <input type="date" value={기간From} onChange={(e) => set기간From(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
              <div className="col-span-6 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">기간(To)</label>
                <input type="date" value={기간To} onChange={(e) => set기간To(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">고객등급</label>
                <select value={고객등급} onChange={(e) => set고객등급(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option>전체</option><option>임직원</option><option>기타</option>
                </select>
              </div>
              <div className="col-span-12 md:col-span-8">
                <label className="block text-xs text-slate-500 mb-1">검진대상자</label>
                <input value={검진대상자} onChange={(e) => set검진대상자(e.target.value)} placeholder="이름/고객사 등 검색" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
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
                {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="date"
                value={bulkConfirmed}
                onChange={(e) => setBulkConfirmed(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                title="예약확정일(선택)"
              />
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
                <th className="px-3 py-3 text-left">예약상태</th>
                <th className="px-3 py-3 text-left">패키지타입</th>
                <th className="px-3 py-3 text-right">회사지원금</th>
                <th className="px-3 py-3 text-right">본인부담금</th>
                <th className="px-3 py-3 text-left">예약신청일</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={15} className="py-16 text-center text-slate-500">데이터가 없습니다.</td></tr>
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
                  <td className="px-3 py-2">{r.예약확정일 || "-"}</td>
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
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Status)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
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


