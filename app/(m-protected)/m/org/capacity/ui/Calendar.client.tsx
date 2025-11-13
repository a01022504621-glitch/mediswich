// app/(m-protected)/m/org/capacity/ui/Calendar.client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/* ───────── date utils ───────── */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const addMonths = (d: Date, diff: number) => {
  const nd = new Date(d);
  nd.setMonth(d.getMonth() + diff);
  return nd;
};
const ymToDate = (ym: string) => new Date(`${ym}-01T00:00:00`);
const formatMonthLabel = (ym: string) => {
  const d = ymToDate(ym);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}`;
};
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/* ───────── types ───────── */
type YMD = `${number}-${number}-${number}`;
type ClosedMap = Record<string, boolean>;
type DayBox = {
  cap: number;
  used: number;
  closed: ClosedMap;
  caps?: Record<string, number>;
  usedBy?: Record<string, number>;
};
type SpecItem = { id: string; name: string };

/* ───────── localStorage helpers ───────── */
const hasWin = () => typeof window !== "undefined";
const lsGet = (k: string) => {
  try {
    if (!hasWin()) return null;
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    if (!hasWin()) return;
    window.localStorage.setItem(k, v);
  } catch {}
};

/* ───────── server helpers ───────── */
async function getCalendar(month: string) {
  const r = await fetch(`/api/capacity/calendar?month=${month}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));

  const map = (j?.days ?? {}) as Partial<Record<YMD, DayBox>>;
  for (const [iso, box] of Object.entries(map) as [YMD, DayBox][]) {
    const c = box.closed ?? {};
    // special = 개별 특수마감 OR 기본마감에 종속
    box.closed = { ...c, special: Boolean((c as any).special || (c as any).col || (c as any).basic) };
  }
  return map as Record<YMD, DayBox>;
}

async function getDefaults(): Promise<{ BASIC: number; SPECIAL: number; examDefaults: Record<string, number> }> {
  try {
    const r = await fetch("/api/capacity/settings/defaults", { cache: "no-store" });
    const j = await r.json();
    return {
      BASIC: Number(j?.defaults?.BASIC ?? 0),
      SPECIAL: Number(j?.defaults?.SPECIAL ?? 0),
      examDefaults: (j?.examDefaults ?? {}) as Record<string, number>,
    };
  } catch {
    return { BASIC: 0, SPECIAL: 0, examDefaults: {} };
  }
}

// 특수검진은 서버에 col로 저장(하위호환)
async function putClose(date: YMD, resource: string, close: boolean) {
  const mapped = resource === "special" ? "col" : resource;
  await fetch("/api/capacity/day", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, resource: mapped, close }),
  });
}

async function getSpecOptions(): Promise<SpecItem[]> {
  try {
    const r = await fetch("/api/capacity/specials", { cache: "no-store" });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
    return arr
      .map((x: any) => ({
        id: String(x.id ?? x.code ?? x.slug ?? x.name),
        name: String(x.name ?? x.label ?? x.id),
      }))
      .filter((x: SpecItem) => x.id && x.name);
  } catch {
    return [];
  }
}

/* ───────── helpers ───────── */
function sundaysOfMonth(ym: string): YMD[] {
  const base = ymToDate(ym);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const out: YMD[] = [];
  for (let d = 1; d <= last; d++) {
    const dt = new Date(base.getFullYear(), base.getMonth(), d);
    if (dt.getDay() === 0) out.push(ymd(dt) as YMD);
  }
  return out;
}

/* ───────── Calendar (admin) ───────── */
export default function Calendar({ initialMonth }: { initialMonth: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<Record<YMD, DayBox>>({});

  const [capBasic, setCapBasic] = useState(0);
  const [capSpecial, setCapSpecial] = useState(0);
  const [capSpecs, setCapSpecs] = useState<Record<string, number>>({});

  // 표시 토글: 로컬스토리지만 신뢰
  const [showSpecial, setShowSpecial] = useState<boolean>(() => lsGet("ms:cap:showSpecial") === "1");

  const [specMenuOpen, setSpecMenuOpen] = useState(false);
  const [specOptions, setSpecOptions] = useState<SpecItem[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>(() => {
    const raw = lsGet("ms:cap:selectedSpecs");
    try {
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  const reload = async (m = month) => {
    setLoading(true);
    try {
      const map = await getCalendar(m);

      // 일요일 자동 기본 마감 업서트
      const sundays = sundaysOfMonth(m);
      const need = sundays.filter((d) => !(map[d]?.closed?.basic));
      if (need.length > 0) {
        const next = structuredClone(map);
        for (const d of need) {
          const box = next[d] ?? { cap: 0, used: 0, closed: {} as ClosedMap };
          next[d] = { ...box, closed: { ...box.closed, basic: true } };
        }
        setDays(next);
        Promise.all(need.map((d) => putClose(d, "basic", true))).catch(() => {});
        return;
      }

      setDays(map || {});
      // 자동 ON 강제 금지 (요청사항). 로컬스토리지 값 유지.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    void (async () => {
      const defs = await getDefaults();
      setCapBasic(defs.BASIC || 0);
      setCapSpecial(defs.SPECIAL || 0);
      setCapSpecs(defs.examDefaults || {});
    })();
    void (async () => setSpecOptions(await getSpecOptions()))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    lsSet("ms:cap:showSpecial", showSpecial ? "1" : "0");
  }, [showSpecial]);
  useEffect(() => {
    lsSet("ms:cap:selectedSpecs", JSON.stringify(selectedSpecs));
  }, [selectedSpecs]);

  const nav = (diff: number) => {
    const next = addMonths(ymToDate(month), diff);
    setMonth(`${next.getFullYear()}-${pad2(next.getMonth() + 1)}`);
  };

  const toggle = async (date: YMD, resource: string, nextClose: boolean) => {
    setDays((cur) => {
      const before = cur[date] ?? { cap: 0, used: 0, closed: {} as ClosedMap };
      const next = structuredClone(cur);
      next[date] = { ...before, closed: { ...before.closed, [resource]: nextClose } };
      return next;
    });
    try {
      await putClose(date, resource, nextClose);
    } catch {
      setDays((cur) => {
        const before = cur[date];
        if (!before) return cur;
        const prevClose = !nextClose;
        const next = structuredClone(cur);
        next[date] = { ...before, closed: { ...before.closed, [resource]: prevClose } };
        return next;
      });
    }
  };

  if (!mounted) return <div className="h-[70vh] rounded-2xl border border-slate-200 bg-white" />;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        {/* 좌측: 네비게이션 묶음(좌상단 고정) */}
        <div className="inline-flex items-center gap-2">
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

        {/* 우측: 컨트롤 묶음. 큰 화면에서는 오른쪽 정렬 */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSpecial((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-sm shadow-sm ${
              showSpecial
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            title="특수검진 카드 표시/관리"
          >
            특수검진관리
          </button>

          <div className="relative">
            <button
              onClick={() => setSpecMenuOpen((v) => !v)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 shadow-sm"
            >
              특정검사관리
            </button>
            {specMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-2 z-20"
                onMouseLeave={() => setSpecMenuOpen(false)}
              >
                <div className="max-h-72 overflow-auto space-y-1">
                  {specOptions.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">등록된 특정검사가 없습니다.</div>
                  ) : (
                    specOptions.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-sm">
                        <input
                          type="checkbox"
                          className="accent-sky-600"
                          checked={selectedSpecs.includes(opt.id)}
                          onChange={() =>
                            setSelectedSpecs((cur) => (cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]))
                          }
                        />
                        <span className="truncate">{opt.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
      <CalendarGrid
        month={month}
        loading={loading}
        days={days}
        showSpecial={showSpecial}
        selectedSpecs={selectedSpecs}
        onToggle={toggle}
        capBasic={capBasic}
        capSpecial={capSpecial}
        capSpecs={capSpecs}
      />
    </div>
  );
}

/* ───────── Grid ───────── */
function CalendarGrid({
  loading,
  month,
  days,
  showSpecial,
  selectedSpecs,
  onToggle,
  capBasic,
  capSpecial,
  capSpecs,
}: {
  loading: boolean;
  month: string;
  days: Record<YMD, DayBox>;
  showSpecial: boolean;
  selectedSpecs: string[];
  onToggle: (date: YMD, resource: string, nextClose: boolean) => void;
  capBasic: number;
  capSpecial: number;
  capSpecs: Record<string, number>;
}) {
  const base = ymToDate(month);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const firstW = first.getDay();
  const lastDate = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

  const skeleton: (YMD | null)[] = [];
  for (let i = 0; i < firstW; i++) skeleton.push(null);
  for (let d = 1; d <= lastDate; d++) skeleton.push(ymd(new Date(base.getFullYear(), base.getMonth(), d)) as YMD);
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
              <DayCell
                key={iso}
                iso={iso}
                box={days[iso]}
                showSpecial={showSpecial}
                selectedSpecs={selectedSpecs}
                onToggle={onToggle}
                capBasic={capBasic}
                capSpecial={capSpecial}
                capSpecs={capSpecs}
              />
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
  showSpecial,
  selectedSpecs,
  onToggle,
  capBasic,
  capSpecial,
  capSpecs,
}: {
  iso: YMD;
  box?: DayBox;
  showSpecial: boolean;
  selectedSpecs: string[];
  onToggle: (date: YMD, resource: string, nextClose: boolean) => void;
  capBasic: number;
  capSpecial: number;
  capSpecs: Record<string, number>;
}) {
  const date = new Date(`${iso}T00:00:00`);
  const wday = date.getDay();
  const today = new Date();
  const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();

  const closed: ClosedMap = { ...(box?.closed ?? {}) };
  if (wday === 0 && closed.basic == null) closed.basic = true;

  const pick = (v?: number, fallback = 0) => (v && v > 0 && v < 900 ? v : fallback);

  const getCap = (res: string) => {
    const byRes = box?.caps?.[res];
    if (res === "basic") return pick(byRes ?? box?.cap, capBasic);
    if (res === "special") return pick(byRes, capSpecial);
    return pick(byRes, capSpecs[res.replace(/^spec:/, "")] ?? 0);
  };

  const getUsed = (res: string) => box?.usedBy?.[res] ?? (res === "basic" ? box?.used ?? 0 : 0);

  const row = (label: string, resource: string) => {
    // 기본 마감이 켜지면 하위 카드도 잠김. 기본 해제 시 자동 해제 표시.
    const isSpec = resource.startsWith("spec:");
    const isClosed =
      resource === "basic"
        ? !!closed.basic
        : resource === "special"
        ? !!(closed.special || closed.basic)
        : !!(closed[resource] || (isSpec ? closed.basic : false));

    const disabled = resource !== "basic" && closed.basic;

    const cap = Math.max(0, Number(getCap(resource) || 0));
    const used = Math.max(0, Number(getUsed(resource) || 0));
    const isFull = cap > 0 && used >= cap;

    const actionLabel = isFull ? "FULL" : isClosed ? "해제" : "마감";
    const onClick = () => {
      if (disabled || isFull) return;
      onToggle(iso, resource, !isClosed);
    };

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
        <span className={`ml-auto tabular-nums ${isFull ? "text-rose-600 font-semibold" : "text-slate-700"}`} title={isFull ? "수용 인원 도달" : undefined}>
          {used}/{cap}
        </span>
        <button
          onClick={onClick}
          disabled={disabled || isFull}
          className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] ${
            isClosed ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-600 border-slate-200"
          } disabled:opacity-50`}
        >
          {actionLabel}
        </button>
      </div>
    );
  };

  const showSpecialRow = showSpecial || closed.special === true || closed.basic === true;

  return (
    <div
      className={`min-h-[9.6rem] border-r border-b p-2 transition ${
        isToday ? "bg-indigo-50/70 ring-1 ring-inset ring-indigo-200" : "bg-white hover:bg-slate-50/70"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">{date.getDate()}</div>
        <Link href={`/m/org/capacity/${iso}`} className="text-[11px] text-slate-500 hover:text-slate-700">
          더보기
        </Link>
      </div>

      <div className="space-y-1">
        {row("기본", "basic")}
        {showSpecialRow && row("특수검진", "special")}
        {selectedSpecs.map((sid) => row(sid, `spec:${sid}`))}
        {closed.basic && <div className="text-[11px] text-slate-500">기본이 마감되어 하위 항목도 잠깁니다.</div>}
      </div>
    </div>
  );
}





