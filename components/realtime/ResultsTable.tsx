"use client";

import type { Status } from "./RealtimeView";
import { useMemo, useState } from "react";

export type RealtimeRow = {
  customer: string;
  patientName: string;
  grade: "임직원" | "기타(가족포함)";
  birthDate: string;
  preferredDate: string;
  status: "예약신청" | "예약확정" | "검진완료" | "취소" | "검진미실시";
  packageType: string;
  specialExam?: boolean;
  specialMaterial?: boolean;
  healthCert?: boolean;
  companySupport?: number;
  selfPay?: number;
  appliedAt: string;
};

export default function ResultsTable({
  rows,
  loading,
  statusFilter,
  setStatusFilter,
}: {
  rows: RealtimeRow[];
  loading?: boolean;
  statusFilter: Status;
  setStatusFilter: (s: Status) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  const totalPage = Math.max(1, Math.ceil(rows.length / pageSize));

  return (
    <div className="card glass">
      {/* 헤더 라인 */}
      <div className="px-5 pt-5 pb-3 rounded-t-2xl bg-white/65 backdrop-blur border-b flex items-center justify-between">
        <div className="text-sm text-gray-600">총 <b>{rows.length.toLocaleString()}</b> 건</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">상태 필터</span>
          <select
            className="input w-[120px] py-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status)}
          >
            <option>전체</option>
            <option>예약신청</option>
            <option>예약확정</option>
            <option>검진완료</option>
            <option>취소</option>
            <option>검진미실시</option>
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="card-inner">
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr className="text-gray-600">
                {[
                  "No","고객사","수검자명","등급","생년월일","검진희망일","예약상태",
                  "패키지타입","특수검진","특수물질","보건증","회사지원금","본인부담금","예약신청일",
                ].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} className="py-16 text-center text-gray-500">불러오는 중…</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={14} className="py-16 text-center text-gray-500">데이터가 없습니다.</td></tr>
              ) : (
                paged.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{(idx + 1) + (page-1)*pageSize}</td>
                    <td className="px-3 py-2">{r.customer}</td>
                    <td className="px-3 py-2">{r.patientName}</td>
                    <td className="px-3 py-2">{r.grade}</td>
                    <td className="px-3 py-2">{r.birthDate}</td>
                    <td className="px-3 py-2">{r.preferredDate}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">{r.packageType}</td>
                    <td className="px-3 py-2">{r.specialExam ? "Y" : "N"}</td>
                    <td className="px-3 py-2">{r.specialMaterial ? "Y" : "N"}</td>
                    <td className="px-3 py-2">{r.healthCert ? "Y" : "N"}</td>
                    <td className="px-3 py-2 text-right">{r.companySupport?.toLocaleString() ?? "0"}</td>
                    <td className="px-3 py-2 text-right">{r.selfPay?.toLocaleString() ?? "0"}</td>
                    <td className="px-3 py-2">{r.appliedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <button
            className="text-gray-600 hover:text-black disabled:opacity-40"
            onClick={()=>setPage((p)=>Math.max(1,p-1))}
            disabled={page===1}
          >
            ‹ 이전
          </button>
          <div className="text-gray-500">{page} / {totalPage}</div>
          <button
            className="text-gray-600 hover:text-black disabled:opacity-40"
            onClick={()=>setPage((p)=>Math.min(totalPage,p+1))}
            disabled={page===totalPage}
          >
            다음 ›
          </button>
        </div>
      </div>
    </div>
  );
}



