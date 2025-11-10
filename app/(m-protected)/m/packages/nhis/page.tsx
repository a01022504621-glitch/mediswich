// app/(m-protected)/m/packages/nhis/page.tsx
"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  loadCodes,
  saveCodes,
  savePackages,
  publishPackages,
  ensureHospitalScope,
  loadPackagesDBFirst,
} from "@/lib/examStore";

/* ================= Types ================= */
type Sex = "A" | "M" | "F";
type ExcelRow = { 카테고리?: string; 검진세부항목?: string; 검사명?: string };
type Exam = { id: string; category: string; detail: string; name: string };

type GroupRow = { examId: string; sex: Sex; memo?: string; code?: string; name?: string };

type DraftPackage = {
  id: string;
  name: string;
  from?: string | null;
  to?: string | null;
  price: number; // 표시가(0 가능)
  base: GroupRow[]; // NHIS는 기본항목만
  showInBooking: boolean; // 예약자 노출
};

/* ================= UI Utils ================= */
const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const inputSm =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const card = "bg-white shadow-sm rounded-2xl border border-gray-200";
const subHead = "px-6 py-3 text-sm font-semibold text-gray-700 border-b";
const body = "px-6 py-6";
const btn = "px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50";
const btnPrimary =
  "px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:opacity-90";

/* ================= Small Utils ================= */
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
const safeArr = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ================= Excel Loader ================= */
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

/* ===== NHIS 변환기 =====
   서버(일반 포맷) 또는 이미-드래프트 → NHIS 드래프트(base[]) */
function isDraftNhisPackage(x: any): x is DraftPackage {
  return x && Array.isArray(x.base) && typeof x.name === "string";
}
function toNhisDraft(raw: any): DraftPackage {
  // 이미 Draft 형태면 필드 보정만 수행
  if (isDraftNhisPackage(raw)) {
    return {
      id: String(raw.id ?? crypto.randomUUID()),
      name: String(raw.name ?? ""),
      from: raw.from ?? null,
      to: raw.to ?? null,
      price: Number.isFinite(raw.price) ? Number(raw.price) : 0,
      base: safeArr<any>(raw.base).map((v) => ({
        examId: v.examId ?? v.id ?? "",
        name: v.name ?? "",
        sex: (v.sex as Sex) ?? "A",
        memo: v.memo ?? "",
        code: v.code ?? "",
      })),
      showInBooking: Boolean(raw.showInBooking ?? true),
    };
  }

  // 서버 포맷(normalized) → Draft 변환
  const groups = raw?.groups || raw?.tags?.groups || {};
  const basic = groups.base || groups.basic || {};
  const values: any[] =
    Array.isArray(basic)
      ? basic
      : Array.isArray(basic.values)
      ? basic.values
      : Array.isArray(basic.items)
      ? basic.items
      : [];

  return {
    id: String(raw?.id ?? crypto.randomUUID()),
    name: String(raw?.name ?? raw?.title ?? ""),
    from: raw?.from ?? raw?.tags?.period?.from ?? raw?.startDate ?? "",
    to: raw?.to ?? raw?.tags?.period?.to ?? raw?.endDate ?? "",
    price: Number.isFinite(raw?.price) ? Number(raw.price) : 0,
    base: values.map((v) => ({
      examId: v.id ?? v.examId ?? "",
      name: v.name ?? "",
      sex: (v.sex as Sex) ?? "A",
      memo: v.memo ?? "",
      code: v.code ?? "",
    })),
    showInBooking: Boolean(raw?.showInBooking ?? raw?.visible ?? true),
  };
}

/* ================= Page ================= */
const NS = "nhis" as const;

export default function NhisPackagesPage() {
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [excelErr, setExcelErr] = useState<string | null>(null);

  // 전역 코드맵 + 서버 오버라이드 연동
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [overrideMap, setOverrideMap] = useState<Record<string, { code?: string; sex?: Sex }>>({});
  const [isPending, startTransition] = useTransition();
  const saveCodesDebounced = useMemo(() => debounce((m: Record<string, string>) => saveCodes(m), 500), []);

  const setCode = useCallback(
    (examId: string, code: string) => {
      setCodes((prev) => {
        const next = { ...prev, [examId]: code };
        saveCodesDebounced(next);
        return next;
      });

      // 빌더 반영
      startTransition(() => {
        setDraft((prev) => ({
          ...prev,
          base: (prev.base || []).map((r) => (r.examId === examId ? { ...r, code } : r)),
        } as DraftPackage));
      });
    },
    [saveCodesDebounced, startTransition],
  );

  // 초기 데이터
  useEffect(() => {
    setCodes(loadCodes()); // 전역 코드맵
    loadExcel()
      .then((rows) => {
        const nhis = rows.filter((r) => /nhis|공단|국가검진/i.test(r.category ?? ""));
        setAllExams(nhis.length ? nhis : rows);
      })
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

  // 변이 락
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

  // 신규 드래프트
  const makeBlank = (): DraftPackage => ({
    id: crypto.randomUUID(),
    name: "공단검진 패키지(예시)",
    from: "",
    to: "",
    price: 0,
    base: [],
    showInBooking: true,
  });

  // DB 우선 로드
  const [packages, setPackages] = useState<DraftPackage[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureHospitalScope();
      const list = (await loadPackagesDBFirst(NS)) as any[];
      if (!alive) return;
      const norm = safeArr<any>(list).map(toNhisDraft);
      setPackages(norm);
      savePackages(NS, norm);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshFromDB = useCallback(async () => {
    const list = (await loadPackagesDBFirst(NS)) as any[];
    const norm = safeArr<any>(list).map(toNhisDraft);
    setPackages(norm);
    savePackages(NS, norm);
  }, []);

  const saveList = (next: DraftPackage[]) => {
    const norm = safeArr(next).map(toNhisDraft);
    setPackages(norm);
    savePackages(NS, norm);
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

  /* 소유 집합 */
  const ownedBase = useMemo(
    () => new Set((draft.base || []).map((r) => r.examId)),
    [draft.base],
  );
  const isInBase = (id: string) => ownedBase.has(id);

  const toggleExam = (examId: string) => {
    const ex = allExams.find((x) => x.id === examId);
    setDraft((prev) => {
      const exists = (prev.base || []).some((r) => r.examId === examId);
      if (exists) {
        return { ...prev, base: (prev.base || []).filter((r) => r.examId !== examId) };
      }
      const sexDefault = overrideMap[examId]?.sex ?? "A";
      const codeDefault = codes[examId] || "";
      return {
        ...prev,
        base: [
          ...(prev.base || []),
          { examId, sex: sexDefault, code: codeDefault, name: ex?.name || "" },
        ],
      };
    });
  };

  const updateRow = (examId: string, patch: Partial<GroupRow>) =>
    setDraft((prev) => ({
      ...prev,
      base: (prev.base || []).map((r) => (r.examId === examId ? { ...r, ...patch } : r)),
    }));

  // 검증/저장
  const isValid = useMemo(() => {
    if (!draft.from || !draft.to) return false;
    if ((draft.base?.length || 0) === 0) return false;
    return true;
  }, [draft]);

  // 오버라이드 업서트
  async function upsertOverridesFromDraft(d: DraftPackage) {
    const rowUpdates = (d.base || []).map((r) => ({
      examId: r.examId,
      code: (r.code || codes[r.examId] || "").trim() || null,
      sex: r.sex,
    }));
    // 코드만 입력된 항목도 반영
    const codeOnly = Object.entries(codes)
      .filter(([, v]) => (v || "").trim().length > 0)
      .map(([examId, code]) => ({ examId, code, sex: null as Sex | null }));

    // 중복 제거: rowUpdates 우선
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
    const next = [...packages];
    const idx = next.findIndex((p) => p.id === draft.id);
    if (idx === -1) next.unshift(draft);
    else next[idx] = draft;

    await withLock(async () => {
      saveList(next);
      await publishPackages(NS, next);
      await upsertOverridesFromDraft(draft); // ← 전역 저장
      await refreshFromDB();
      saveCodes(codes); // 전역 코드맵 저장
      setMode("list");
    });
  };

  /* ================ Render ================ */
  if (mode === "list") {
    return (
      <div className="p-5 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-sky-600">공단(NHIS)</span> 패키지 등록
          </h1>
        </div>

        <section className={card}>
          <div className={subHead}>등록된 공단(NHIS) 패키지</div>
          <div className={body}>
            <div className="mb-4 flex items-center justify-between">
              <button className={btnPrimary} onClick={() => { setDraft(makeBlank()); setMode("edit"); }} disabled={busy}>
                패키지 추가
              </button>
            </div>

            {packages.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">아직 등록된 패키지가 없습니다.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {packages.map((p) => {
                  const baseCount = p.base?.length ?? 0;
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

                      <div className="text-xs text-gray-500">{p.from || "-"} ~ {p.to || "-"}</div>

                      <div className="flex items-center gap-3 text-sm">
                        <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md">
                          기본 {baseCount}
                        </span>
                        <span className="ml-auto font-medium">
                          {(p.price || 0).toLocaleString()}원
                        </span>
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
                          <button className={btn} onClick={() => { setDraft(p); setMode("edit"); }} disabled={busy}>
                            수정
                          </button>
                          <button
                            className={btn}
                            onClick={async () => {
                              const cp = { ...p, id: crypto.randomUUID(), name: `${p.name} 복제` };
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
                            className="px-3 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50"
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
          <span className="text-sky-600">공단(NHIS)</span> 패키지 등록
        </h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-sky-600 scale-110"
              checked={draft.showInBooking}
              onChange={(e) => setDraft({ ...draft, showInBooking: e.target.checked })}
            />
            예약자페이지 노출
          </label>
          <button className={btn} onClick={() => setMode("list")} disabled={busy}>
            목록으로
          </button>
          <button
            className={clsx(btnPrimary, !isValid && "opacity-50 cursor-not-allowed")}
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
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">표시 금액</label>
            <input
              className={clsx(input, "text-right")}
              inputMode="numeric"
              value={draft.price}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">유효 시작일</label>
            <input
              type="date"
              className={input}
              value={draft.from || ""}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">유효 종료일</label>
            <input
              type="date"
              className={input}
              value={draft.to || ""}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
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
                    c === cat
                      ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                      : "border-gray-300 hover:bg-gray-50",
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
                const selected = isInBase(e.id);
                return (
                  <div
                    key={e.id}
                    className={clsx(
                      "w-full rounded-lg border px-3 py-2 mb-2 transition flex items-center gap-2",
                      selected ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200",
                    )}
                  >
                    <button
                      className="flex-1 text-left hover:opacity-80"
                      onClick={() => toggleExam(e.id)}
                    >
                      <div className="truncate text-sm">{e.name}</div>
                      <div className="truncate text-[11px] text-gray-500">{e.detail}</div>
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

        {/* 우: 빌더 */}
        <section className={clsx(card, "lg:col-span-7")}>
          <div className={subHead}>패키지 빌더 (기본 항목)</div>

          <div className="px-6 mt-4">
            <div
              className="text-[11px] text-gray-500 grid items-center gap-2 mb-2"
              style={{
                gridTemplateColumns:
                  "minmax(220px,1fr) 88px minmax(220px,1fr) 120px 48px",
              }}
            >
              <span>검사명</span>
              <span>성별</span>
              <span>비고</span>
              <span>코드</span>
              <span> </span>
            </div>
          </div>

          <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
            {(draft.base || []).length === 0 ? (
              <div className="py-12 text-center text-gray-400 border rounded-xl">
                좌측 목록에서 항목을 클릭해 추가해 주세요.
              </div>
            ) : (
              <div className="space-y-2">
                {draft.base.map((row) => (
                  <div
                    key={row.examId}
                    className="rounded-lg border border-gray-200 px-3 py-2 grid items-center gap-2 min-h-[40px]"
                    style={{
                      gridTemplateColumns:
                        "minmax(220px,1fr) 88px minmax(220px,1fr) 120px 48px",
                    }}
                  >
                    <div className="truncate font-medium pr-2">{row.name || "검사명"}</div>
                    <select
                      className={inputSm}
                      value={row.sex}
                      onChange={(e) => updateRow(row.examId, { sex: e.target.value as Sex })}
                    >
                      <option value="A">전체</option>
                      <option value="M">남</option>
                      <option value="F">여</option>
                    </select>
                    <input
                      className={inputSm}
                      placeholder="비고"
                      value={row.memo || ""}
                      onChange={(e) => updateRow(row.examId, { memo: e.target.value })}
                    />
                    <input
                      className={inputSm}
                      placeholder="코드"
                      value={row.code || ""}
                      onChange={(e) => setCode(row.examId, e.target.value)}
                    />
                    <button
                      className="text-xs text-gray-500 hover:text-gray-900 px-2"
                      onClick={() => toggleExam(row.examId)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}



