"use client";

import type { DateType, Grade } from "./RealtimeView";

export default function FiltersBar(props: {
  year: number; setYear: (n: number) => void;
  dateType: DateType; setDateType: (v: DateType) => void;
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
  target: string; setTarget: (v: string) => void;
  grade: Grade; setGrade: (v: Grade) => void;
  onDownload: () => void; loading?: boolean;
  compactLayout?: boolean;
}) {
  const {
    year, setYear, dateType, setDateType, from, to, setFrom, setTo,
    target, setTarget, grade, setGrade, onDownload, loading,
  } = props;

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 2025 + 1 }, (_, i) => thisYear - i);

  const datesDisabled = dateType === "전체";

  return (
    <div className="space-y-4">
      {/* 1) 검진연도 */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">검진연도</label>
          <select className="input" value={year} onChange={(e)=>setYear(Number(e.target.value))}>
            {years.map((y)=> <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* 2) 조회구분 + 기간 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">조회구분</label>
          <select className="input" value={dateType} onChange={(e)=>setDateType(e.target.value as DateType)}>
            <option>전체</option>
            <option>예약신청일</option>
            <option>예약희망일</option>
            <option>예약확정일</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">기간(From)</label>
          <input type="date" className={`input ${datesDisabled?"opacity-60 pointer-events-none":""}`}
                 value={from} onChange={(e)=>setFrom(e.target.value)} disabled={datesDisabled}/>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">기간(To)</label>
          <input type="date" className={`input ${datesDisabled?"opacity-60 pointer-events-none":""}`}
                 value={to} onChange={(e)=>setTo(e.target.value)} disabled={datesDisabled}/>
        </div>
      </div>

      {/* 3) 고객등급 */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">고객등급</label>
          <select className="input" value={grade} onChange={(e)=>setGrade(e.target.value as Grade)}>
            <option>전체</option>
            <option>임직원</option>
            <option>기타(가족포함)</option>
          </select>
        </div>
      </div>

      {/* 4) 검진대상자 + 엑셀 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">검진대상자</label>
          <input className="input" placeholder="이름/고객사 등 검색"
                 value={target} onChange={(e)=>setTarget(e.target.value)} />
        </div>

        <div className="flex md:justify-end">
          <button
            onClick={onDownload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white/80 backdrop-blur border hover:shadow-md transition"
            title="엑셀(CSV)로 내려받기"
          >
            {/* Excel 아이콘 (inline) */}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M4 4h10a2 2 0 0 1 2 2v2h4v10a2 2 0 0 1-2 2H8l-4-4V6a2 2 0 0 1 2-2zm8 14h6V10h-4V8h-2v10zm-6.9-9.5 2.9 3.5-3 3.5h2.4l1.8-2.3 1.8 2.3h2.4l-3-3.5 2.9-3.5h-2.4l-1.7 2.2-1.7-2.2H5.1z"/>
            </svg>
            <span className="text-sm font-medium">엑셀(CSV) 다운로드</span>
          </button>
        </div>
      </div>
    </div>
  );
}


