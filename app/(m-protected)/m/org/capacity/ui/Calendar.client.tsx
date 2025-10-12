"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/* ───────── date utils ───────── */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const addMonths = (d: Date, diff: number) => {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + diff);
  return nd;
};
const ymToDate = (ym: string) => new Date(`${ym}-01T00:00:00`);
const formatMonthLabel = (ym: string) => {
  const d = ymToDate(ym);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}`;
};
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/* ───────── types ───────── */
type YMD = `${number}-${number}-${number}`;
type DayBox = {
  cap: number;
  used: number;
  closed: { basic: boolean; egd: boolean; col: boolean };
};

/* ───────── fetch helper ───────── */
async function getCalendar(month: string) {
  const r = await fetch(`/api/capacity/calendar?month=${month}`, {
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  // API: { ok, days: Record<YMD, DayBox> }
  const map = (j?.days ?? {}) as Record<YMD, DayBox>;
  return map;
}

async function putClose(date: YMD, resource: "basic" | "egd" | "col", close: boolean) {
  await fetch("/api/capacity/day", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, resource, close }),
  });
}

/* ───────── Calendar (admin) ───────── */
export default function Calendar({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<Record<YMD, DayBox>>({});

  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  const reload = async (m = month) => {
    setLoading(true);
    try {
      const map = await getCalendar(m);
      setDays(map || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const nav = (diff: number) => {
    const next = addMonths(ymToDate(month), diff);
    setMonth(`${next.getFullYear()}-${pad2(next.getMonth() + 1)}`);
  };

  // 즉시 토글(낙관적 업데이트)
  const toggle = async (date: YMD, key: "basic" | "egd" | "col") => {
    setDays((cur) => {
      const box = cur[date] || { cap: 999, used: 0, closed: { basic: false, egd: false, col: false } };
      const isFull = (box.used ?? 0) >= (box.cap ?? 0);
      const now = !!box.closed[key];
      const wantClose = !now; // 열려있으면 닫기, 닫혀있으면 열기
      // FULL이면 오픈 불가
      if (isFull && !wantClose) return cur;

      const next = structuredClone(cur);
      next[date] = {
        ...box,
        closed: { ...box.closed, [key]: wantClose },
      };
      // 기본을 닫으면 나머지도 잠금 표기(실제 반영은 Public API 쪽이 전체 CLOSED 처리)
      if (key === "basic" && wantClose) {
        next[date].closed.egd = true;
        next[date].closed.col = true;
      }
      return next;
    });

    try {
      const box = days[date];
      const isFull = (box?.used ?? 0) >= (box?.cap ?? 0);
      const now = !!box?.closed?.[key];
      const wantClose = !now;
      if (isFull && !wantClose) return;
      await putClose(date, key, wantClose);
      // 서버 상태 동기화
      await reload();
    } catch {
      // 실패 시 롤백 대신 전체 리로드
      await reload();
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="h-9 w-9 rounded-full grid place-items-center hover:bg-gray-100 active:bg-gray-200"
            onClick={() => nav(-1)}
            aria-label="이전 달"
          >
            ◀
          </button>
          <div className="text-xl font-bold tracking-tight">{monthLabel}</div>
          <button
            className="h-9 w-9 rounded-full grid place-items-center hover:bg-gray-100 active:bg-gray-200"
            onClick={() => nav(1)}
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/m/org/capacity/defaults"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 shadow-sm"
          >
            기본케파설정
          </Link>
          <Link
            href="/m/org/capacity/specials"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 shadow-sm"
          >
            특정검사설정
          </Link>
        </div>
      </div>

      {/* 캘린더 */}
      <CalendarGrid month={month} loading={loading} days={days} onToggle={toggle} />
    </div>
  );
}

/* ───────── Grid ───────── */
function CalendarGrid({
  loading,
  month,
  days,
  onToggle,
}: {
  loading: boolean;
  month: string;
  days: Record<YMD, DayBox>;
  onToggle: (date: YMD, key: "basic" | "egd" | "col") => void;
}) {
  const base = ymToDate(month);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const firstW = first.getDay();
  const lastDate = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

  const skeleton: (YMD | null)[] = [];
  for (let i = 0; i < firstW; i++) skeleton.push(null);
  for (let d = 1; d <= lastDate; d++) {
    const date = new Date(base.getFullYear(), base.getMonth(), d);
    skeleton.push(ymd(date) as YMD);
  }
  while (skeleton.length % 7 !== 0) skeleton.push(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.2)]">
      <div className="grid grid-cols-7 border-b bg-[linear-gradient(180deg,rgba(99,102,241,0.06),transparent)]">
        {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => (
          <div
            key={w}
            className={`py-2 text-center text-[12px] font-semibold tracking-wide ${
              i === 0 ? "text-rose-500" : i === 6 ? "text-indigo-600" : "text-slate-600"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500">불러오는 중…</div>
      ) : (
        <div className="grid grid-cols-7">
          {skeleton.map((iso, i) =>
            iso ? (
              <DayCell key={iso} iso={iso} box={days[iso]} onToggle={onToggle} />
            ) : (
              <div key={`e-${i}`} className="min-h-[9.6rem] border-r border-b bg-white" />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Day cell ───────── */
function DayCell({
  iso,
  box,
  onToggle,
}: {
  iso: YMD;
  box?: DayBox;
  onToggle: (date: YMD, key: "basic" | "egd" | "col") => void;
}) {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const cap = box?.cap ?? 999;
  const used = box?.used ?? 0;
  const closed = box?.closed ?? { basic: false, egd: false, col: false };
  const isFull = used >= cap;
  const basicClosed = !!closed.basic;

  const row = (label: string, key: "basic" | "egd" | "col", opts?: { showCount?: boolean }) => {
    const isClosed = !!closed[key];
    const disabled = key !== "basic" && basicClosed; // 기본 닫힘 → 하위 잠금
    const actionLabel = isFull
      ? "FULL"
      : isClosed
      ? "오픈"
      : "클로즈";

    return (
      <div
        className={`w-full inline-flex items-center gap-2 px-2 py-1 rounded-md border text-[11px] shadow-sm ${
          disabled
            ? "bg-slate-100/70 border-slate-200/70 text-slate-400 opacity-60"
            : isClosed
            ? "bg-slate-100 border-slate-200"
            : "bg-white border-slate-200"
        }`}
      >
        <span className="shrink-0 font-medium text-slate-700">{label}</span>

        {opts?.showCount && (
          <span
            className={`ml-auto tabular-nums ${
              isFull ? "text-rose-600 font-semibold" : "text-slate-700"
            }`}
            title={isFull ? "수용 인원 도달" : undefined}
          >
            {used}/{cap}
          </span>
        )}

        {/* 오른쪽 끝 액션 버튼 */}
        <button
          onClick={() => !disabled && !isFull && onToggle(iso, key)}
          disabled={disabled || isFull}
          className={`ml-auto shrink-0 px-1.5 py-0.5 rounded border text-[10px] ${
            isClosed
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-white text-slate-600 border-slate-200"
          } disabled:opacity-50`}
        >
          {actionLabel}
        </button>
      </div>
    );
  };

  return (
    <div
      className={`min-h-[9.6rem] border-r border-b p-2 transition ${
        isToday
          ? "bg-indigo-50/70 ring-1 ring-inset ring-indigo-200"
          : "bg-white hover:bg-slate-50/70"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{date.getDate()}</div>
        <Link
          href={`/m/org/capacity/${iso}`}
          className="text-[11px] text-slate-500 hover:text-slate-700"
        >
          더보기
        </Link>
      </div>

      <div className="space-y-1">
        {row("기본", "basic", { showCount: true })}
        {row("위내시경(EGD)", "egd")}
        {row("대장내시경(COL)", "col")}

        {basicClosed && (
          <div className="text-[11px] text-slate-500">
            기본이 마감되어 하위 항목도 잠깁니다.
          </div>
        )}
        {isFull && !basicClosed && (
          <div className="text-[11px] text-rose-600">수용 인원 초과(FULL)</div>
        )}
      </div>
    </div>
  );
}



