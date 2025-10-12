"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ───────── utils ───────── */
type YMD = `${number}-${number}-${number}`;
type DayBox = {
  cap: number;
  used: number;
  closed: { basic: boolean; egd: boolean; col: boolean };
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toMonth = (iso: YMD) => `${iso.slice(0, 4)}-${iso.slice(5, 7)}`;
const weekKo = ["일", "월", "화", "수", "목", "금", "토"];

async function getMonthMap(month: string) {
  const r = await fetch(`/api/capacity/calendar?month=${month}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  return (j?.days ?? {}) as Record<YMD, DayBox>;
}
async function putClose(date: YMD, resource: "basic" | "egd" | "col", close: boolean) {
  await fetch("/api/capacity/day", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, resource, close }),
  });
}

/* ───────── page ───────── */
export default function DayDetailPage() {
  const { date } = useParams<{ date: YMD }>();
  const router = useRouter();

  const [box, setBox] = useState<DayBox | null>(null);
  const [loading, setLoading] = useState(true);

  const month = useMemo(() => toMonth(date), [date]);
  const dObj = useMemo(() => new Date(`${date}T00:00:00`), [date]);
  const title = useMemo(
    () =>
      `${dObj.getFullYear()}.${pad2(dObj.getMonth() + 1)}.${pad2(dObj.getDate())} (${weekKo[dObj.getDay()]
      })`,
    [dObj],
  );

  const reload = async () => {
    setLoading(true);
    try {
      const m = await getMonthMap(month);
      setBox(m[date] ?? { cap: 999, used: 0, closed: { basic: false, egd: false, col: false } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const isFull = (box?.used ?? 0) >= (box?.cap ?? 0);
  const lockChildren = !!box?.closed.basic;

  const toggle = async (key: "basic" | "egd" | "col") => {
    if (!box) return;
    if (key !== "basic" && lockChildren) return;
    if (isFull && !box.closed[key]) return; // FULL이면 오픈 금지
    // optimistic
    const next = { ...box, closed: { ...box.closed, [key]: !box.closed[key] } };
    if (key === "basic" && !box.closed.basic) {
      next.closed.egd = true;
      next.closed.col = true;
    }
    setBox(next);
    try {
      await putClose(date, key, next.closed[key]);
      await reload();
    } catch {
      await reload();
    }
  };

  const quick = async (mode: "open-all" | "close-all" | "close-basic") => {
    if (!box) return;
    setLoading(true);
    try {
      if (mode === "close-all" || mode === "close-basic") {
        await putClose(date, "basic", true);
      } else {
        // 열기 전 FULL이면 무시
        if (!isFull) await putClose(date, "basic", false);
      }
      if (mode === "close-all") {
        await Promise.all([
          putClose(date, "egd", true),
          putClose(date, "col", true),
        ]);
      }
      await reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-slate-600">
            총 수용 {box?.cap ?? "-"} · 예약 {box?.used ?? "-"}{" "}
            {isFull && <span className="text-rose-600 font-medium">· FULL</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/m/org/capacity"
            onClick={(e) => {
              e.preventDefault();
              router.back();
            }}
            className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ← 돌아가기
          </Link>
          <Link
            href="/m/org/capacity"
            className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            월 달력
          </Link>
        </div>
      </div>

      {/* 퀵 액션 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => quick("open-all")}
          disabled={loading || isFull}
          className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
        >
          기본 오픈
        </button>
        <button
          onClick={() => quick("close-basic")}
          disabled={loading}
          className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          기본 클로즈
        </button>
        <button
          onClick={() => quick("close-all")}
          disabled={loading}
          className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          전체 클로즈(기본/위/대장)
        </button>
      </div>

      {/* 카드들 */}
      <div className="grid gap-3 max-w-xl">
        <Row
          label="기본"
          count={`${box?.used ?? 0}/${box?.cap ?? 0}`}
          closed={!!box?.closed.basic}
          disabled={false}
          full={isFull}
          onClick={() => toggle("basic")}
        />
        <Row
          label="위내시경(EGD)"
          closed={!!box?.closed.egd}
          disabled={lockChildren}
          onClick={() => toggle("egd")}
        />
        <Row
          label="대장내시경(COL)"
          closed={!!box?.closed.col}
          disabled={lockChildren}
          onClick={() => toggle("col")}
        />
        {lockChildren && (
          <div className="text-[12px] text-slate-500">
            기본이 클로즈되어 하위 항목은 잠겨 있습니다.
          </div>
        )}
        {isFull && !box?.closed.basic && (
          <div className="text-[12px] text-rose-600">
            일일 수용 인원 초과(FULL)로 오픈할 수 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────── small row ───────── */
function Row({
  label,
  count,
  closed,
  disabled,
  full,
  onClick,
}: {
  label: string;
  count?: string;
  closed: boolean;
  disabled: boolean;
  full?: boolean;
  onClick: () => void;
}) {
  const action = full ? "FULL" : closed ? "오픈" : "클로즈";
  return (
    <div
      className={`w-full inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] shadow-sm ${
        disabled
          ? "bg-slate-100/70 border-slate-200/70 text-slate-400 opacity-60"
          : closed
          ? "bg-slate-50 border-slate-200"
          : "bg-white border-slate-200"
      }`}
    >
      <span className="font-medium text-slate-800">{label}</span>
      {count && (
        <span
          className={`ml-auto tabular-nums ${
            full ? "text-rose-600 font-semibold" : "text-slate-700"
          }`}
        >
          {count}
        </span>
      )}
      <button
        onClick={() => !disabled && !full && onClick()}
        disabled={disabled || !!full}
        className={`ml-2 shrink-0 px-2 py-1 rounded border text-[12px] ${
          closed
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-white text-slate-700 border-slate-200"
        } disabled:opacity-50`}
      >
        {action}
      </button>
    </div>
  );
}

