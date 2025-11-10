// app/(m-protected)/m/packages/general/page.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
  useTransition,
  useCallback,
} from "react";
import {
  loadCodes,
  saveCodes,
  savePackages,
  publishPackages,
  ensureHospitalScope,
  loadPackagesDBFirst,
  clearLocal,
} from "@/lib/examStore";

/* ===== Types ===== */
type Sex = "A" | "M" | "F";
type ExcelRow = { 카테고리?: string; 검진세부항목?: string; 검사명?: string };
type Exam = { id: string; category: string; detail: string; name: string };

type GroupId = string;
type GroupRow = { examId: string; sex: Sex; memo?: string; code?: string; name?: string };
type GroupMeta = {
  id: GroupId;
  label: string;
  color: "sky" | "slate";
  chooseCount?: number | null;
};
type Addon = { name: string; sex: Sex | "ALL"; price: number };

type DraftPackage = {
  id: string;
  name: string;
  from?: string | null;
  to?: string | null;
  price: number;
  groups: Record<GroupId, GroupRow[]>;
  groupOrder: GroupId[];
  groupMeta: Record<GroupId, GroupMeta>;
  addons: Addon[];
  showInBooking: boolean;
};

/* ===== UI Utils ===== */
const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const inputSm =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const card = "bg-white shadow-sm rounded-2xl border border-gray-200";
const subHead = "px-6 py-3 text-sm font-semibold text-gray-700 border-b";
const body = "px-6 py-6";
const btn = "px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50";
const btnPrimary = "px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:opacity-90";

/* ===== Small Utils ===== */
const clone = <T,>(v: T): T =>
  typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));

function stableId(category: string, detail: string, name: string) {
  const key = [category, detail, name].map((s) => (s || "").trim().toLowerCase()).join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return "ex_" + h.toString(36);
}
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 500) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
const safeArr = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

/* ===== Excel Loader ===== */
async function loadExcel(): Promise<Exam[]> {
  const XLSX = await import("xlsx");
  const res = await fetch("/list.xlsx", { cache: "no-store" });
  if (!res.ok) throw new Error("list.xlsx 를 불러오지 못했습니다.");
  const ab = await res.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(ws);

  const toExam = (r: ExcelRow): Exam | null => {
    const category = (r.카테고리 || "").toString().trim();
    const detail = (r.검진세부항목 || "").toString().trim();
    const name = (r.검사명 || "").toString().trim();
    if (!category || !name) return null;
    return { id: stableId(category, detail, name), category, detail, name };
  };

  return rows.map(toExam).filter(Boolean) as Exam[];
}

/* ===== Draft 표준화 ===== */
function ensureBase(p: DraftPackage): DraftPackage {
  const next = clone(p);
  if (!next.groups) next.groups = {};
  if (!Array.isArray(next.groups.base)) next.groups.base = [];
  if (!next.groupMeta) next.groupMeta = {} as any;
  if (!next.groupMeta.base)
    next.groupMeta.base = { id: "base", label: "기본검사", color: "sky", chooseCount: 0 };
  if (!Array.isArray(next.groupOrder)) next.groupOrder = ["base"];
  if (!next.groupOrder.includes("base")) next.groupOrder.unshift("base");
  if (!Array.isArray(next.addons)) next.addons = [];
  if (typeof next.showInBooking !== "boolean") next.showInBooking = true;
  if (typeof next.price !== "number") next.price = Number(next.price) || 0;
  return next;
}

/* ===== Page ===== */
const NS = "general" as const;

export default function GeneralPackagesPage() {
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [excelErr, setExcelErr] = useState<string | null>(null);

  const [codes, setCodes] = useState<Record<string, string>>({});
  const [overrideMap, setOverrideMap] = useState<Record<string, { code?: string; sex?: Sex }>>({});
  const [, startTransition] = useTransition();

  // 단일 변이 락
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const withLock = useCallback(async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  const saveCodesDebounced = useMemo(() => debounce(saveCodes, 500), []);

  const setCode = useCallback(
    (examId: string, code: string) => {
      setCodes((prev) => {
        const next = { ...prev, [examId]: code };
        saveCodesDebounced(next);
        return next;
      });

      // 빌더 영역에 코드 동기 반영
      startTransition(() => {
        setDraft((prev) => {
          const groups = { ...prev.groups };
          for (const gid of prev.groupOrder) {
            const rows = groups[gid] || [];
            let changed = false;
            const nextRows = rows.map((r) => {
              if (r.examId !== examId) return r;
              changed = true;
              return { ...r, code };
            });
            if (changed) groups[gid] = nextRows;
          }
          return { ...prev, groups };
        });
      });
    },
    [saveCodesDebounced, startTransition],
  );

  // 초기 로드
  useEffect(() => {
    setCodes(loadCodes());
    loadExcel()
      .then(setAllExams)
      .catch((e) => setExcelErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // 서버 오버라이드 로드 → 코드맵과 병합
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/m/exams/overrides", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json().catch(() => null as any);
        const map = (j?.map || {}) as Record<string, { code?: string; sex?: Sex }>;
        setOverrideMap(map);

        const merged = { ...loadCodes() };
        for (const [k, v] of Object.entries(map)) {
          if (v?.code) merged[k] = v.code;
        }
        setCodes(merged);
        saveCodesDebounced(merged);
      } catch {
        /* ignore */
      }
    })();
  }, [saveCodesDebounced]);

  // 신규 드래프트
  const makeBlank = (): DraftPackage =>
    ensureBase({
      id: (crypto as any)?.randomUUID?.() ?? `pkg_${Math.random().toString(36).slice(2)}`,
      name: "종합검진 패키지(예시)",
      from: "",
      to: "",
      price: 0,
      groups: { base: [], opt_A: [] },
      groupOrder: ["base", "opt_A"],
      groupMeta: {
        base: { id: "base", label: "기본검사", color: "sky", chooseCount: 0 },
        opt_A: { id: "opt_A", label: "선택검사 A", color: "slate", chooseCount: 1 },
      },
      addons: [],
      showInBooking: true,
    });

  // DB 우선 로드
  const [packages, setPackages] = useState<DraftPackage[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureHospitalScope();
      const list = (await loadPackagesDBFirst(NS)) as DraftPackage[];
      if (!alive) return;
      const norm = safeArr<DraftPackage>(list).map(ensureBase);
      setPackages(norm);
      if (norm.length === 0) clearLocal(NS);
      else savePackages(NS, norm);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshFromDB = useCallback(async () => {
    const list = (await loadPackagesDBFirst(NS)) as DraftPackage[];
    const norm = safeArr<DraftPackage>(list).map(ensureBase);
    setPackages(norm);
    if (norm.length === 0) clearLocal(NS);
    else savePackages(NS, norm);
  }, []);

  const saveList = (next: DraftPackage[]) => {
    const norm = safeArr<DraftPackage>(next).map(ensureBase);
    setPackages(norm);
    if (norm.length === 0) clearLocal(NS);
    else savePackages(NS, norm);
  };

  const [mode, setMode] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<DraftPackage>(makeBlank());

  /* 좌측 목록 필터 */
  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(allExams.map((e) => e.category).filter(Boolean)))],
    [allExams],
  );
  const [cat, setCat] = useState("전체");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);

  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return allExams.filter(
      (e) =>
        (cat === "전체" || e.category === cat) &&
        (!s || e.name.toLowerCase().includes(s) || e.detail.toLowerCase().includes(s)),
    );
  }, [allExams, cat, dq]);

  /* 빌더 상태 */
  const [activeGroup, setActiveGroup] = useState<GroupId>("base");
  const [activeTab, setActiveTab] = useState<"builder" | "addons">("builder");
  const meta = (gid: GroupId) => draft.groupMeta[gid];
  const count = (gid: GroupId) => safeArr<GroupRow>(draft.groups[gid]).length;

  function nextOptId() {
    const used = new Set([
      ...draft.groupOrder.filter((id) => id.startsWith("opt_")).map((id) => id.replace("opt_", "")),
      ...Object.keys(draft.groupMeta).filter((id) => id.startsWith("opt_")).map((id) => id.replace("opt_", "")),
    ]);
    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(65 + i);
      if (!used.has(ch)) return `opt_${ch}`;
    }
    const mx = Array.from(used).reduce((m, c) => Math.max(m, c.charCodeAt(0)), 64);
    return `opt_${String.fromCharCode(mx + 1)}`;
  }

  const addGroup = () => {
    const id = nextOptId();
    if (draft.groupOrder.includes(id) || draft.groupMeta[id]) return;
    setDraft((prev) =>
      ensureBase({
        ...prev,
        groupOrder: [...prev.groupOrder, id],
        groups: { ...prev.groups, [id]: [] },
        groupMeta: {
          ...prev.groupMeta,
          [id]: { id, label: `선택검사 ${id.replace("opt_", "")}`, color: "slate", chooseCount: 1 },
        },
      }),
    );
    setActiveGroup(id);
    setActiveTab("builder");
  };

  const removeGroup = (gid: GroupId) => {
    if (gid === "base") return;
    setDraft((prev) => {
      const { [gid]: _drop, ...restG } = prev.groups;
      const { [gid]: _dropM, ...restM } = prev.groupMeta;
      return ensureBase({
        ...prev,
        groups: restG,
        groupMeta: restM,
        groupOrder: prev.groupOrder.filter((x) => x !== gid),
      });
    });
    if (activeGroup === gid) setActiveGroup("base");
  };

  // 소유 맵
  const ownerRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const m = new Map<string, string>();
    for (const gid of draft.groupOrder) for (const r of draft.groups[gid] || []) m.set(r.examId, gid);
    ownerRef.current = m;
  }, [draft.groupOrder, draft.groups]);

  const isInCurrent = (examId: string) =>
    safeArr<GroupRow>(draft.groups[activeGroup]).some((r) => r.examId === examId);

  const toggleExam = (examId: string) => {
    const ex = allExams.find((x) => x.id === examId);
    setDraft((prev) => {
      const groups = { ...prev.groups };
      const here = groups[activeGroup] || [];
      const idx = here.findIndex((r) => r.examId === examId);

      if (idx >= 0) {
        groups[activeGroup] = [...here.slice(0, idx), ...here.slice(idx + 1)];
        ownerRef.current.delete(examId);
      } else {
        const owner = ownerRef.current.get(examId);
        if (owner && owner !== activeGroup) {
          groups[owner] = (groups[owner] || []).filter((r) => r.examId !== examId);
        }
        const sexDefault = overrideMap[examId]?.sex ?? "A";
        groups[activeGroup] = [
          ...here,
          { examId, sex: sexDefault, code: codes[examId] || "", name: ex?.name || "" },
        ];
        ownerRef.current.set(examId, activeGroup);
      }

      return ensureBase({ ...prev, groups });
    });
  };

  const clearGroup = (gid: GroupId) =>
    setDraft((prev) => ensureBase({ ...prev, groups: { ...prev.groups, [gid]: [] } }));

  const updateRow = (gid: GroupId, examId: string, patch: Partial<GroupRow>) =>
    setDraft((prev) =>
      ensureBase({
        ...prev,
        groups: {
          ...prev.groups,
          [gid]: safeArr<GroupRow>(prev.groups[gid]).map((r) =>
            r.examId === examId ? { ...r, ...patch } : r,
          ),
        },
      }),
    );

  const setChooseCount = (gid: GroupId, n: number) =>
    setDraft((prev) =>
      ensureBase({
        ...prev,
        groupMeta: {
          ...prev.groupMeta,
          [gid]: { ...prev.groupMeta[gid], chooseCount: Math.max(0, Math.floor(n)) },
        },
      }),
    );

  // Addons(로컬 패키지 전용 UI — 병원 마스터 추가검사와 별개)
  const [addonName, setAddonName] = useState("");
  const [addonSex, setAddonSex] = useState<Sex | "ALL">("ALL");
  const [addonPrice, setAddonPrice] = useState("");

  const addAddon = () => {
    const price = Number((addonPrice || "").replace(/[^0-9]/g, "")) || 0;
    if (!addonName.trim()) return;
    setDraft((prev) =>
      ensureBase({
        ...prev,
        addons: [...safeArr(prev.addons), { name: addonName.trim(), sex: addonSex, price }],
      }),
    );
    setAddonName("");
    setAddonPrice("");
  };
  const removeAddon = (idx: number) =>
    setDraft((prev) => ensureBase({ ...prev, addons: safeArr(prev.addons).filter((_, i) => i !== idx) }));

  // 검증/저장 — 이름 + base 1개 이상만
  const isValid = useMemo(() => {
    const hasName = !!(draft.name || "").trim();
    const baseCount = safeArr<GroupRow>(draft.groups?.base).length;
    return hasName && baseCount > 0;
  }, [draft]);

  // 오버라이드 업서트
  async function upsertOverridesFromDraft(d: DraftPackage) {
    const rows: GroupRow[] = d.groupOrder.flatMap((gid) => safeArr<GroupRow>(d.groups[gid]));
    const rowUpdates = rows.map((r) => ({
      examId: r.examId,
      code: (r.code || codes[r.examId] || "").trim() || null,
      sex: r.sex,
    }));
    const codeOnly = Object.entries(codes)
      .filter(([, v]) => (v || "").trim().length > 0)
      .map(([examId, code]) => ({ examId, code, sex: null as Sex | null }));

    const seen = new Set<string>();
    const merged: { examId: string; code?: string | null; sex?: Sex | null }[] = [];
    for (const u of [...rowUpdates, ...codeOnly]) {
      if (seen.has(u.examId)) continue;
      seen.add(u.examId);
      merged.push(u);
    }

    if (!merged.length) return;
    await fetch("/api/m/exams/overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates: merged }),
    }).catch(() => {});
  }

  const saveDraft = async () => {
    if (!isValid) return;
    const normalized = ensureBase(draft);
    const next = [...packages];
    const idx = next.findIndex((p) => p.id === normalized.id);
    if (idx === -1) next.unshift(normalized);
    else next[idx] = normalized;

    await withLock(async () => {
      saveList(next);
      await publishPackages(NS, next);
      await upsertOverridesFromDraft(normalized);
      await refreshFromDB();
      saveCodes(codes);
      setMode("list");
    });
  };

  /* ===== Render ===== */
  if (mode === "list") {
    return (
      <div className="p-5 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-sky-600">종합검진</span> 패키지 등록
          </h1>
        </div>

        <section className={card}>
          <div className={subHead}>등록된 패키지</div>
          <div className={body}>
            <div className="mb-4 flex items-center justify-between">
              <button className={clsx(btnPrimary, busy && "opacity-60")} onClick={() => { setDraft(makeBlank()); setActiveGroup("base"); setActiveTab("builder"); setMode("edit"); }} disabled={busy}>
                패키지 추가
              </button>
            </div>

            {packages.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">아직 등록된 패키지가 없습니다.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {packages.map((p) => {
                  const baseCount = safeArr<GroupRow>(p.groups?.base).length;
                  const optIds = Object.keys(p.groupMeta || {}).filter((id) => id !== "base");
                  const optionGroups = optIds.length;
                  const chooseSum = optIds.reduce(
                    (a, id) => a + (Number(p.groupMeta[id]?.chooseCount) || 0),
                    0,
                  );
                  return (
                    <div key={p.id} className="rounded-xl border p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-semibold truncate">{p.name}</div>
                        <span
                          className={clsx(
                            "text-xs px-2 py-0.5 rounded-full border",
                            p.showInBooking
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-50 text-gray-600 border-gray-200",
                          )}
                        >
                          {p.showInBooking ? "예약자 노출" : "미노출"}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500">
                        {p.from || "-"} ~ {p.to || "-"}
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md">기본 {baseCount}</span>
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md">선택묶음 {optionGroups}</span>
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md">필수합 {chooseSum}</span>
                        <span className="ml-auto font-medium">{(p.price || 0).toLocaleString()}원</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="accent-sky-600 scale-110"
                            checked={p.showInBooking}
                            onChange={async (e) => {
                              const next = packages.map((x) => (x.id === p.id ? { ...x, showInBooking: e.target.checked } : x));
                              await withLock(async () => {
                                saveList(next);
                                await publishPackages(NS, next);
                                await refreshFromDB();
                              });
                            }}
                            disabled={busy}
                          />
                          예약자페이지 노출
                        </label>
                        <div className="flex gap-2">
                          <button className={btn} onClick={() => { setDraft(ensureBase(clone(p))); setActiveGroup("base"); setActiveTab("builder"); setMode("edit"); }} disabled={busy}>
                            수정
                          </button>
                          <button
                            className={btn}
                            onClick={async () => {
                              const cp = ensureBase(clone(p));
                              cp.id = (crypto as any)?.randomUUID?.() ?? `pkg_${Math.random().toString(36).slice(2)}`;
                              cp.name = `${p.name} 복제`;
                              const next = [cp, ...packages];
                              await withLock(async () => {
                                saveList(next);
                                await publishPackages(NS, next);
                                await refreshFromDB();
                              });
                            }}
                            disabled={busy}
                          >
                            복제
                          </button>
                          <button
                            className="px-3 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                            onClick={async () => {
                              if (!confirm("해당 패키지를 삭제하시겠습니까?")) return;
                              const next = packages.filter((x) => x.id !== p.id);
                              await withLock(async () => {
                                saveList(next);
                                await publishPackages(NS, next);
                                await refreshFromDB();
                              });
                            }}
                            disabled={busy}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // 편집 화면
  return (
    <div className="p-5 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-sky-600">종합검진</span> 패키지 등록
        </h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-sky-600 scale-110"
              checked={draft.showInBooking}
              onChange={(e) => setDraft(ensureBase({ ...draft, showInBooking: e.target.checked }))}
            />
            예약자페이지 노출
          </label>
          <button className={btn} onClick={() => setMode("list")} disabled={busy}>
            목록으로
          </button>
          <button
            className={clsx(btnPrimary, (!isValid || busy) && "opacity-50 cursor-not-allowed")}
            onClick={saveDraft}
            disabled={!isValid || busy}
          >
            저장
          </button>
        </div>
      </div>

      {/* 기본정보 */}
      <section className={card}>
        <div className={subHead}>패키지 기본 정보</div>
        <div className={body + " grid grid-cols-1 md:grid-cols-6 gap-4"}>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">패키지명</label>
            <input
              className={input}
              value={draft.name}
              onChange={(e) => setDraft(ensureBase({ ...draft, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">표시 금액</label>
            <input
              className={clsx(input, "text-right")}
              inputMode="numeric"
              value={draft.price}
              onChange={(e) =>
                setDraft(
                  ensureBase({
                    ...draft,
                    price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                  }),
                )
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">유효 시작일</label>
            <input
              type="date"
              className={input}
              value={draft.from || ""}
              onChange={(e) => setDraft(ensureBase({ ...draft, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">유효 종료일</label>
            <input
              type="date"
              className={input}
              value={draft.to || ""}
              onChange={(e) => setDraft(ensureBase({ ...draft, to: e.target.value }))}
            />
          </div>
        </div>
      </section>

      {/* 좌/우 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌: 항목 검색/선택 */}
        <section className={clsx(card, "lg:col-span-5")}>
          <div className={subHead}>검사항목 리스트</div>
          <div className={body + " space-y-3"}>
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={clsx(
                    "px-3 py-1.5 rounded-full text-xs border transition",
                    c === cat ? "bg-sky-600 text-white border-sky-600 shadow-sm" : "border-gray-300 hover:bg-gray-50",
                  )}
                >
                  {c}
                </button>
              ))}
              <div className="flex-1" />
              <input
                className={clsx(input, "max-w-xs")}
                placeholder="검사명/세부항목 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {loading && <div className="text-gray-500 text-sm">엑셀을 불러오는 중…</div>}
            {excelErr && <div className="text-red-600 text-sm">엑셀 오류: {excelErr}</div>}

            <div className="max-h-[65vh] overflow-y-auto pr-1">
              {filtered.map((e) => {
                const selected = isInCurrent(e.id);
                return (
                  <div
                    key={e.id}
                    className={clsx(
                      "w-full rounded-lg border px-3 py-2 mb-2 transition flex items-center gap-2",
                      selected ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200",
                    )}
                  >
                    <button className="flex-1 text-left hover:opacity-80" onClick={() => toggleExam(e.id)}>
                      <div className="truncate text-sm">{e.name}</div>
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-gray-500">코드</span>
                      <input
                        className={clsx(inputSm, "w-[120px]")}
                        value={codes[e.id] || ""}
                        onChange={(ev) => setCode(e.id, ev.target.value)}
                        placeholder="선택"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 우: 빌더/추가검사 */}
        <section className={clsx(card, "lg:col-span-7")}>
          <div className="px-6 pt-4 flex items-center gap-2">
            <button
              className={clsx(
                "px-3 py-1.5 rounded-full text-sm border",
                activeTab === "builder" ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50",
              )}
              onClick={() => setActiveTab("builder")}
            >
              패키지 빌더
            </button>
            <button
              className={clsx(
                "px-3 py-1.5 rounded-full text-sm border",
                activeTab === "addons" ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50",
              )}
              onClick={() => setActiveTab("addons")}
            >
              추가검사 등록
            </button>
          </div>

          {activeTab === "builder" ? (
            <>
              <div className="px-6 pt-4 flex items-center gap-3 flex-wrap">
                <div className="inline-flex rounded-full bg-gray-100 p-1">
                  {draft.groupOrder.map((gid) => {
                    const m = meta(gid);
                    const active = gid === activeGroup;
                    const color =
                      m.color === "sky"
                        ? active
                          ? "bg-sky-600 text-white"
                          : "text-gray-600 hover:text-gray-900"
                        : active
                        ? "bg-slate-700 text-white"
                        : "text-gray-600 hover:text-gray-900";
                    return (
                      <button
                        key={gid}
                        className={clsx("px-4 py-2 rounded-full text-sm transition", color)}
                        onClick={() => setActiveGroup(gid)}
                      >
                        {m.label} {count(gid)}건
                        {typeof m.chooseCount === "number" ? <span className="ml-1">· 필수 {m.chooseCount}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <button className={btn} onClick={addGroup}>
                  + 그룹 추가
                </button>

                {activeGroup !== "base" && (
                  <>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-600">필수 선택</span>
                      <input
                        type="number"
                        min={0}
                        className={clsx(inputSm, "w-[70px]")}
                        value={meta(activeGroup).chooseCount ?? 1}
                        onChange={(e) => setChooseCount(activeGroup, parseInt(e.target.value || "0", 10))}
                      />
                      <span className="text-gray-600">개</span>
                    </div>
                    <button
                      className="px-3 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => removeGroup(activeGroup)}
                    >
                      현재 그룹 삭제
                    </button>
                  </>
                )}

                <div className="flex-1" />
                <button
                  className="px-3 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => clearGroup(activeGroup)}
                >
                  전체 비우기
                </button>
              </div>

              <div className="px-6 mt-4">
                <div
                  className="text-[11px] text-gray-500 grid items-center gap-2 mb-2"
                  style={{ gridTemplateColumns: "minmax(220px,1fr) 88px minmax(220px,1fr) 120px 48px" }}
                >
                  <span>검사명</span>
                  <span>성별</span>
                  <span>비고</span>
                  <span>코드</span>
                  <span> </span>
                </div>
              </div>

              <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
                {safeArr<GroupRow>(draft.groups[activeGroup]).length === 0 ? (
                  <div className="py-12 text-center text-gray-400 border rounded-xl">
                    좌측 목록에서 항목을 클릭해 추가해 주세요.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {safeArr<GroupRow>(draft.groups[activeGroup]).map((row) => (
                      <div
                        key={row.examId}
                        className="rounded-lg border border-gray-200 px-3 py-2 grid items-center gap-2 min-h-[40px]"
                        style={{ gridTemplateColumns: "minmax(220px,1fr) 88px minmax(220px,1fr) 120px 48px" }}
                      >
                        <div className="truncate font-medium pr-2">{row.name || "검사명"}</div>
                        <select
                          className={inputSm}
                          value={row.sex}
                          onChange={(e) => updateRow(activeGroup, row.examId, { sex: e.target.value as Sex })}
                        >
                          <option value="A">전체</option>
                          <option value="M">남</option>
                          <option value="F">여</option>
                        </select>
                        <input
                          className={inputSm}
                          placeholder="비고"
                          value={row.memo || ""}
                          onChange={(e) => updateRow(activeGroup, row.examId, { memo: e.target.value })}
                        />
                        <input
                          className={inputSm}
                          placeholder="코드"
                          value={row.code || ""}
                          onChange={(e) => setCode(row.examId, e.target.value)}
                        />
                        <button className="text-xs text-gray-500 hover:text-gray-900 px-2" onClick={() => toggleExam(row.examId)}>
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            // 추가검사 탭
            <div className="p-6 space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">항목명</label>
                  <input className={input} value={addonName} onChange={(e) => setAddonName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">성별</label>
                  <select className={inputSm} value={addonSex} onChange={(e) => setAddonSex(e.target.value as any)}>
                    <option value="ALL">전체</option>
                    <option value="M">남</option>
                    <option value="F">여</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">비용(원)</label>
                  <input
                    className={clsx(inputSm, "w-[140px] text-right")}
                    inputMode="numeric"
                    value={addonPrice}
                    onChange={(e) => setAddonPrice(e.target.value)}
                  />
                </div>
                <button className={btn} onClick={addAddon}>
                  추가
                </button>
              </div>

              <div className="mt-4 rounded-xl border overflow-hidden">
                <div className="grid grid-cols-12 gap-0 text-xs bg-gray-50 px-3 py-2">
                  <div className="col-span-7">항목명</div>
                  <div className="col-span-2">성별</div>
                  <div className="col-span-2 text-right">비용</div>
                  <div className="col-span-1" />
                </div>

                {safeArr<Addon>(draft.addons).length === 0 ? (
                  <div className="px-3 py-6 text-sm text-gray-400">등록된 추가검사가 없습니다.</div>
                ) : (
                  safeArr<Addon>(draft.addons).map((a, i) => (
                    <div key={i} className="grid grid-cols-12 gap-0 items-center px-3 py-2 border-t text-sm">
                      <div className="col-span-7">{a.name}</div>
                      <div className="col-span-2">{a.sex === "ALL" ? "전체" : a.sex === "M" ? "남" : "여"}</div>
                      <div className="col-span-2 text-right">{(a.price || 0).toLocaleString()}원</div>
                      <div className="col-span-1 text-right">
                        <button className="text-xs text-gray-500 hover:text-red-600" onClick={() => removeAddon(i)}>
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}






