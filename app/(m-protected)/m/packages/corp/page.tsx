// app/(m-protected)/m/packages/corp/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import useSWR from "swr";
import ClientSelect from "./_components/ClientSelect.client";
import {
  loadCodes,
  saveCodes,
  upsertCode,
  loadPackages,
  savePackages,
  publishPackages, // 저장/토글/삭제 시점에만 서버 반영
} from "@/lib/examStore";


/* ===== Types ===== */
type Sex = "A" | "M" | "F";
type ExcelRow = { 카테고리?: string; 검진세부항목?: string; 검사명?: string };
type Exam = { id: string; category: string; detail: string; name: string };
type Client = { id: string; name: string };

type GroupId = string;
type GroupRow = { examId: string; name?: string; sex: Sex; memo?: string; code?: string };
type GroupMeta = { id: GroupId; label: string; color: "sky" | "slate"; chooseCount?: number | null };
type Addon = { name: string; sex: Sex | "ALL"; price: number };

/** 구독형 판매 설정 */
type BillingType = "one_time" | "subscription";
type Billing = {
  type: BillingType;
  /** 구독 단가 (원). one_time일 때는 무시됨 */
  price?: number | null;
  /** 구독 주기 */
  period?: "monthly" | "yearly" | "weekly" | "custom";
  /** custom 주기(예: 3 → 3개월/3주 등) */
  intervalCount?: number | null;
  /** 무료체험 일수 */
  trialDays?: number | null;
  /** 호환용 플래그 */
  enabled?: boolean;
};

type CorpPackage = {
  id: string;
  clientId: string; // 필수
  name: string;
  from?: string | null;
  to?: string | null;
  price: number;
  groups: Record<GroupId, GroupRow[]>;
  groupOrder: GroupId[];
  groupMeta: Record<GroupId, GroupMeta>;
  addons: Addon[];
  showInBooking: boolean;
  /** 판매 설정(일시결제/구독). 서버 저장 시 tags.billing 로 전달됨 */
  billing?: Billing;
};

/* ===== UI / Utils ===== */
const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const card = "bg-white shadow-sm rounded-2xl border border-gray-200";
const subHead = "px-6 py-3 text-sm font-semibold text-gray-700 border-b";
const body = "px-6 py-6";
const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const inputSm = "w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const btn = "px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50";
const btnPrimary = "px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:opacity-90";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

/* ===== Small Utils ===== */
// 결정적 ID (카테고리|세부|검사명 기반) → Excel 순서 바뀌어도 동일 ID
function stableId(category: string, detail: string, name: string) {
  const key = [category, detail, name].map((s) => (s || "").trim().toLowerCase()).join("|");
  // 경량 FNV-like 해시 → base36
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return "ex_" + h.toString(36);
}

/* ===== Excel ===== */
async function loadExcel(): Promise<Exam[]> {
  const XLSX = await import("xlsx");
  const res = await fetch("/list.xlsx", { cache: "no-store" });
  if (!res.ok) throw new Error("list.xlsx 파일을 불러오지 못했습니다.");
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

/* ===== 고객사별 그리드 ===== */
function GridByClient({
  clients,
  items,
  onAdd,
  onEdit,
  onClone,
  onDelete,
  onToggleShow,
  companyFilter,
  setCompanyFilter,
}: {
  clients: Client[];
  items: CorpPackage[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleShow: (id: string, v: boolean) => void;
  companyFilter: string;
  setCompanyFilter: (id: string) => void;
}) {
  const byClient = useMemo(() => {
    const map = new Map<string, CorpPackage[]>();
    items.forEach((p) => {
      if (companyFilter && p.clientId !== companyFilter) return;
      const arr = map.get(p.clientId) || [];
      arr.push(p);
      map.set(p.clientId, arr);
    });
    return Array.from(map.entries());
  }, [items, companyFilter]);

  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name || "(삭제됨)";

  const basicCount = (p: CorpPackage) => p.groups.base?.length ?? 0;
  const optCount = (p: CorpPackage) =>
    p.groupOrder.filter((g) => g !== "base").reduce((a, g) => a + Math.max(0, p.groupMeta[g]?.chooseCount ?? 0), 0);

  return (
    <section className={card}>
      <div className={subHead}>고객사별 패키지 목록</div>
      <div className={body}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">고객사 필터</span>
            <select className={inputSm + " w-[220px]"} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">전체</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button className={btnPrimary} onClick={onAdd}>패키지 추가</button>
        </div>

        {byClient.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">표시할 패키지가 없습니다.</div>
        ) : (
          <div className="space-y-8">
            {byClient.map(([cid, list]) => (
              <div key={cid} className="space-y-3">
                <div className="text-base font-bold">{nameOf(cid)}</div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((p) => {
                    const bCnt = basicCount(p);
                    const oCnt = optCount(p);
                    const billing = p.billing?.type === "subscription" ? `구독 ${p.billing?.price?.toLocaleString() ?? "-"}원/${p.billing?.period ?? "monthly"}` : "일시결제";

                    return (
                      <div key={p.id} className="flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-base font-semibold">{p.name}</div>
                          <span className={clsx("rounded-full border px-2 py-0.5 text-xs",
                            p.showInBooking ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-gray-50 text-gray-600 border-gray-200")}>
                            {p.showInBooking ? "예약자 노출" : "미노출"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">{p.from || "-"} ~ {p.to || "-"}</div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-700">기본 {bCnt}</span>
                          <span className="rounded-md bg-slate-50 px-2 py-0.5 text-slate-700">선택 {oCnt}</span>
                          <span className="ml-auto font-medium">{(p.price || 0).toLocaleString()}원</span>
                        </div>
                        <div className="text-xs text-gray-600">판매: {billing}</div>
                        <div className="flex items-center justify-between border-t pt-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="scale-110 accent-sky-600"
                              checked={p.showInBooking}
                              onChange={(e) => onToggleShow(p.id, e.target.checked)}
                            />
                            예약자페이지 노출
                          </label>
                          <div className="flex gap-2">
                            <button className={btn} onClick={() => onEdit(p.id)}>수정</button>
                            <button className={btn} onClick={() => onClone(p.id)}>복제</button>
                            <button
                              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              onClick={() => onDelete(p.id)}
                            >삭제</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ===== Page ===== */
const NS = "corp" as const;

export default function CorpPackagesPage() {
  // 마운트 후 로컬스토리지 접근
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [excelErr, setExcelErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setCodes(loadCodes());
    setPackages(loadPackages(NS));
    loadExcel().then(setAllExams).catch((e) => setExcelErr(e.message)).finally(() => setLoading(false));
  }, [ready]);

  /* 고객사 */
  const { data: clientResp } = useSWR<{ items: Client[] }>("/api/clients?take=200", fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  const clients: Client[] = clientResp?.items ?? [];

  /* 목록/편집 공통 */
  const makeBlank = (): CorpPackage => ({
    id: `pkg_${Date.now()}`,
    clientId: "",
    name: "기업검진 패키지(예시)",
    from: "",
    to: "",
    price: 0,
    groups: { base: [], opt_A: [] }, // 기본 + 선택 A
    groupOrder: ["base", "opt_A"],
    groupMeta: {
      base: { id: "base", label: "기본검사", color: "sky" },
      opt_A: { id: "opt_A", label: "선택검사 A", color: "slate", chooseCount: 1 },
    },
    addons: [],
    showInBooking: true,
    billing: { type: "one_time" }, // 기본은 일시결제
  });

  const [packages, setPackages] = useState<CorpPackage[]>([]);
  const saveList = (next: CorpPackage[]) => { setPackages(next); if (ready) savePackages(NS, next); };

  const [mode, setMode] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<CorpPackage>(makeBlank());
  const [companyFilter, setCompanyFilter] = useState("");

  /* 좌측 리스트 필터 */
  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(allExams.map((e) => e.category).filter(Boolean)))],
    [allExams]
  );
  const [cat, setCat] = useState("전체");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return allExams.filter((e) => (cat === "전체" || e.category === cat) && (!s || e.name.toLowerCase().includes(s) || e.detail.toLowerCase().includes(s)));
  }, [allExams, cat, dq]);

  /* 빌더 + 탭 로직 */
  const [activeGroup, setActiveGroup] = useState<GroupId>("base");
  const [activeTab, setActiveTab] = useState<"builder" | "addons">("builder");
  useEffect(() => { setActiveGroup("base"); setActiveTab("builder"); }, [mode]);

  const meta = (gid: GroupId) => draft.groupMeta[gid];
  const count = (gid: GroupId) => draft.groups[gid]?.length || 0;

  /** 옵션 그룹 아이디 생성(A~Z, 중복 방지) */
  function nextOptId() {
    const usedFromOrder = draft.groupOrder
      .filter((id) => id.startsWith("opt_")).map((id) => id.replace("opt_", ""));
    const usedFromMeta = Object.keys(draft.groupMeta)
      .filter((id) => id.startsWith("opt_")).map((id) => id.replace("opt_", ""));
    const used = new Set([...usedFromOrder, ...usedFromMeta]);
    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(65 + i);
      if (!used.has(ch)) return `opt_${ch}`;
    }
    const maxChar = Array.from(used).reduce((m, c) => Math.max(m, c.charCodeAt(0)), 64);
    return `opt_${String.fromCharCode(maxChar + 1)}`;
  }

  const addGroup = () => {
    const id = nextOptId();
    if (draft.groupOrder.includes(id) || draft.groupMeta[id]) return; // 이중 클릭 가드
    setDraft((prev) => ({
      ...prev,
      groupOrder: [...prev.groupOrder, id],
      groups: { ...prev.groups, [id]: [] },
      groupMeta: { ...prev.groupMeta, [id]: { id, label: `선택검사 ${id.replace("opt_", "")}`, color: "slate", chooseCount: 1 } },
    }));
    setActiveGroup(id);
    setActiveTab("builder");
  };

  const removeGroup = (gid: GroupId) => {
    if (gid === "base") return;
    setDraft((prev) => {
      const { [gid]: _drop, ...restG } = prev.groups;
      const { [gid]: _drop2, ...restM } = prev.groupMeta;
      return { ...prev, groups: restG, groupMeta: restM, groupOrder: prev.groupOrder.filter((x) => x !== gid) };
    });
    if (activeGroup === gid) setActiveGroup("base");
  };

  const setChooseCount = (gid: GroupId, n: number) =>
    setDraft((prev) => ({
      ...prev,
      groupMeta: { ...prev.groupMeta, [gid]: { ...prev.groupMeta[gid], chooseCount: Math.max(0, Math.floor(n || 0)) } },
    }));

  // 한 항목은 한 그룹에만 소속
  const ownerRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const m = new Map<string, string>();
    for (const gid of draft.groupOrder) for (const r of (draft.groups[gid] || [])) m.set(r.examId, gid);
    ownerRef.current = m;
  }, [draft.groupOrder, draft.groups]);

  const isInCurrent = (examId: string) => (draft.groups[activeGroup] || []).some((r) => r.examId === examId);

  const toggleExam = (examId: string) => {
    const ex = allExams.find((x) => x.id === examId);
    setDraft((prev) => {
      const next = structuredClone(prev) as CorpPackage;
      // 다른 그룹에 있으면 제거
      next.groupOrder.forEach((gid) => {
        if (gid !== activeGroup) next.groups[gid] = (next.groups[gid] || []).filter((r) => r.examId !== examId);
      });
      const here = next.groups[activeGroup] || [];
      const idx = here.findIndex((r) => r.examId === examId);
      if (idx >= 0) {
        here.splice(idx, 1);
        ownerRef.current.delete(examId);
      } else {
        here.push({ examId, name: ex?.name || "", sex: "A", code: codes[examId] || "" });
        ownerRef.current.set(examId, activeGroup);
      }
      next.groups[activeGroup] = here;
      return next;
    });
  };

  const setCode = (examId: string, code: string) => {
    const m = upsertCode(examId, code); // 로컬 코드맵 저장(디바운스 X)
    setCodes(m);
    setDraft((prev) => {
      const cp = structuredClone(prev) as CorpPackage;
      cp.groupOrder.forEach((gid) => (cp.groups[gid] = (cp.groups[gid] || []).map((r) => (r.examId === examId ? { ...r, code } : r))));
      return cp;
    });
  };

  const clearGroup = (gid: GroupId) => setDraft((prev) => ({ ...prev, groups: { ...prev.groups, [gid]: [] } }));
  const updateRow = (gid: GroupId, examId: string, patch: Partial<GroupRow>) =>
    setDraft((prev) => ({
      ...prev,
      groups: { ...prev.groups, [gid]: (prev.groups[gid] || []).map((r) => (r.examId === examId ? { ...r, ...patch } : r)) },
    }));

  /* 추가검사(Addons) */
  const [addonName, setAddonName] = useState("");
  const [addonSex, setAddonSex] = useState<Sex | "ALL">("ALL");
  const [addonPrice, setAddonPrice] = useState("");

  const addAddon = () => {
    const price = Number((addonPrice || "").replace(/[^0-9]/g, "")) || 0;
    if (!addonName.trim()) return;
    setDraft((prev) => ({ ...prev, addons: [...prev.addons, { name: addonName.trim(), sex: addonSex, price }] }));
    setAddonName(""); setAddonPrice("");
  };
  const removeAddon = (idx: number) => setDraft((prev) => ({ ...prev, addons: prev.addons.filter((_, i) => i !== idx) }));

  /* 유효성 */
  const validClient = clients.some((c) => c.id === draft.clientId);
  const isValid = useMemo(() => {
    if (!validClient) return false;
    if (!draft.from || !draft.to) return false;
    for (const gid of draft.groupOrder) if ((draft.groups[gid]?.length || 0) === 0) return false;
    return true;
  }, [draft, validClient]);

  /* 저장/게시 */
  const saveDraft = async () => {
    if (!isValid) return;
    const next = [...packages];
    const idx = next.findIndex((p) => p.id === draft.id);
    if (idx === -1) next.unshift(draft);
    else next[idx] = draft;
    saveList(next);                  // 로컬만 저장
    await publishPackages(NS, next); // 이때만 서버 반영 (tags.billing 포함)
    saveCodes(codes);
    setMode("list");
  };

  /* 목록 */
  if (mode === "list") {
    return (
      <div className="p-5 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight"><span className="text-sky-600">기업검진</span> 패키지 등록</h1>
        </div>

        <GridByClient
          clients={clients}
          items={packages}
          onAdd={() => { setDraft(makeBlank()); setActiveGroup("base"); setActiveTab("builder"); setMode("edit"); }}
          onEdit={(id) => { const p = packages.find((x) => x.id === id)!; setDraft(structuredClone(p)); setActiveGroup("base"); setActiveTab("builder"); setMode("edit"); }}
          onClone={async (id) => {
            const src = packages.find((x) => x.id === id)!;
            const cp = structuredClone(src); cp.id = `pkg_${Date.now()}`; cp.name = `${src.name} 복제`;
            const next = [cp, ...packages];
            saveList(next);
            await publishPackages(NS, next); // 즉시 반영
          }}
          onDelete={async (id) => {
            if (!window.confirm("해당 패키지를 삭제하시겠습니까?")) return;
            const next = packages.filter((x) => x.id !== id);
            saveList(next);
            await publishPackages(NS, next); // 즉시 반영
          }}
          onToggleShow={async (id, v) => {
            const next = packages.map((p) => (p.id === id ? { ...p, showInBooking: v } : p));
            saveList(next);
            await publishPackages(NS, next); // 즉시 반영
          }}
          companyFilter={companyFilter}
          setCompanyFilter={setCompanyFilter}
        />
      </div>
    );
  }

  /* 편집 */
  const billing = draft.billing ?? { type: "one_time" as BillingType };

  return (
    <div className="p-5 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight"><span className="text-sky-600">기업검진</span> 패키지 등록</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="scale-110 accent-sky-600"
                   checked={draft.showInBooking}
                   onChange={(e) => setDraft({ ...draft, showInBooking: e.target.checked })}/>
            예약자페이지 노출
          </label>
          <button className={btn} onClick={() => setMode("list")}>목록으로</button>
          <button className={clsx(btnPrimary, !isValid && "cursor-not-allowed opacity-50")} onClick={saveDraft} disabled={!isValid}>저장</button>
        </div>
      </div>

      {/* 기본 정보 */}
      <section className={card}>
        <div className={subHead}>패키지 기본 정보</div>
        <div className={body + " grid grid-cols-1 gap-4 md:grid-cols-7"}>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">고객사</label>
            <ClientSelect name="clientId" value={draft.clientId} onChange={(id) => setDraft({ ...draft, clientId: id })} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">패키지명</label>
            <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">표시 금액</label>
            <input className={clsx(input, "text-right")} inputMode="numeric"
                   value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}/>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">유효 시작일</label>
            <input type="date" className={input} value={draft.from || ""} onChange={(e) => setDraft({ ...draft, from: e.target.value })}/>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">유효 종료일</label>
            <input type="date" className={input} value={draft.to || ""} onChange={(e) => setDraft({ ...draft, to: e.target.value })}/>
          </div>
        </div>
      </section>

      {/* 판매 설정(일시결제/구독) */}
      <section className={card}>
        <div className={subHead}>판매 설정</div>
        <div className={body + " grid grid-cols-1 gap-4 md:grid-cols-12"}>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-semibold text-gray-600">판매 방식</label>
            <select
              className={input}
              value={billing.type}
              onChange={(e) => {
                const type = e.target.value as BillingType;
                setDraft((prev) => ({ ...prev, billing: type === "subscription" ? { ...(prev.billing||{}), type, enabled: true } : { type: "one_time" } }));
              }}
            >
              <option value="one_time">일시결제</option>
              <option value="subscription">구독</option>
            </select>
          </div>

          {billing.type === "subscription" ? (
            <>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">구독가(원)</label>
                <input
                  className={clsx(input, "text-right")}
                  inputMode="numeric"
                  value={billing.price ?? ""}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    billing: { ...(prev.billing || { type: "subscription", enabled: true }), price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }
                  }))}
                />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">주기</label>
                <select
                  className={input}
                  value={billing.period ?? "monthly"}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    billing: { ...(prev.billing || { type: "subscription", enabled: true }), period: e.target.value as any }
                  }))}
                >
                  <option value="monthly">월간</option>
                  <option value="yearly">연간</option>
                  <option value="weekly">주간</option>
                  <option value="custom">사용자 지정</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Custom 주기 수</label>
                <input
                  type="number"
                  className={input}
                  min={1}
                  placeholder="예: 3"
                  value={billing.intervalCount ?? ""}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    billing: { ...(prev.billing || { type: "subscription", enabled: true }), intervalCount: Math.max(1, Number(e.target.value || 0)) }
                  }))}
                />
                <p className="mt-1 text-[11px] text-gray-500">period가 <b>custom</b>일 때만 사용</p>
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">무료체험(일)</label>
                <input
                  type="number"
                  className={input}
                  min={0}
                  placeholder="예: 7"
                  value={billing.trialDays ?? ""}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    billing: { ...(prev.billing || { type: "subscription", enabled: true }), trialDays: Math.max(0, Number(e.target.value || 0)) }
                  }))}
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-9 flex items-end text-xs text-gray-600">
              일시결제: 표시 금액은 상단의 <b>표시 금액</b>을 사용합니다.
            </div>
          )}
        </div>
      </section>

      {/* 2열 레이아웃 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 좌측: 검사항목 리스트 */}
        <section className={clsx(card, "lg:col-span-5")}>
          <div className={subHead}>검사항목 리스트</div>
          <div className={body + " space-y-3"}>
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((c) => (
                <button key={c} onClick={() => setCat(c)}
                        className={clsx("rounded-full border px-3 py-1.5 text-xs transition",
                          c === cat ? "border-sky-600 bg-sky-600 text-white shadow-sm" : "border-gray-300 hover:bg-gray-50")}>
                  {c}
                </button>
              ))}
              <div className="flex-1" />
              <input className={clsx(input, "max-w-xs")}
                     placeholder="검사명/세부항목 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {loading && <div className="text-sm text-gray-500">엑셀을 불러오는 중…</div>}
            {excelErr && <div className="text-sm text-red-600">엑셀 오류: {excelErr}</div>}

            <div className="max-h-[65vh] overflow-y-auto pr-1">
              {filtered.map((e) => {
                const selected = isInCurrent(e.id);
                return (
                  <div key={e.id}
                       className={clsx("mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 transition",
                         selected ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200")}>
                    <button className="flex-1 text-left hover:opacity-80" onClick={() => toggleExam(e.id)}>
                      <div className="truncate text-sm">{e.name}</div>
                      {!!e.detail && <div className="text-[11px] text-gray-500">{e.detail}</div>}
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-gray-500">코드</span>
                      <input className={clsx(inputSm, "w-[120px]")}
                             value={codes[e.id] || ""} onChange={(ev) => setCode(e.id, ev.target.value)} placeholder="선택" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 우측: 탭(빌더 / 추가검사 등록) */}
        <section className={clsx(card, "lg:col-span-7")}>
          <div className="flex items-center gap-2 px-6 pt-4">
            <button className={clsx("rounded-full border px-3 py-1.5 text-sm", activeTab === "builder" ? "border-gray-900 bg-gray-900 text-white" : "hover:bg-gray-50")} onClick={() => setActiveTab("builder")}>패키지 빌더</button>
            <button className={clsx("rounded-full border px-3 py-1.5 text-sm", activeTab === "addons" ? "border-gray-900 bg-gray-900 text-white" : "hover:bg-gray-50")} onClick={() => setActiveTab("addons")}>추가검사 등록</button>
          </div>

          {activeTab === "builder" ? (
            <>
              <div className="flex flex-wrap items-center gap-3 px-6 pt-4">
                <div className="inline-flex rounded-full bg-gray-100 p-1">
                  {draft.groupOrder.map((gid) => {
                    const m = meta(gid); const active = gid === activeGroup;
                    const color = m.color === "sky"
                      ? (active ? "bg-sky-600 text-white" : "text-gray-600 hover:text-gray-900")
                      : (active ? "bg-slate-700 text-white" : "text-gray-600 hover:text-gray-900");
                    return (
                      <button key={gid} className={clsx("rounded-full px-4 py-2 text-sm transition", color)} onClick={() => setActiveGroup(gid)}>
                        {m.label} {count(gid)}건{typeof m.chooseCount === "number" ? ` · 필수 ${m.chooseCount}` : ""}
                      </button>
                    );
                  })}
                </div>
                <button className={btn} onClick={addGroup}>+ 그룹 추가</button>
                {activeGroup !== "base" && (
                  <>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-600">필수 선택</span>
                      <input type="number" min={0} className={clsx(inputSm, "w-[70px]")}
                             value={meta(activeGroup).chooseCount ?? 1}
                             onChange={(e) => setChooseCount(activeGroup, parseInt(e.target.value || "0", 10))}/>
                      <span className="text-gray-600">개</span>
                    </div>
                    <button className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => removeGroup(activeGroup)}>
                      현재 그룹 삭제
                    </button>
                  </>
                )}
                <div className="flex-1" />
                <button className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => clearGroup(activeGroup)}>
                  전체 비우기
                </button>
              </div>

              <div className="px-6 pt-4">
                <div className="mb-2 grid items-center gap-2 text-[11px] text-gray-500"
                     style={{ gridTemplateColumns: "minmax(220px,1fr) 88px minmax(220px,1fr) 120px 48px" }}>
                  <span>검사명</span><span>성별</span><span>비고</span><span>코드</span><span> </span>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto px-6 pb-6">
                {(draft.groups[activeGroup] || []).length === 0 ? (
                  <div className="rounded-xl border py-12 text-center text-gray-400">좌측 목록에서 항목을 클릭해 추가해 주세요.</div>
                ) : (
                  <div className="space-y-2">
                    {(draft.groups[activeGroup] || []).map((row) => (
                      <div key={row.examId}
                           className="grid min-h:[40px] items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
                           style={{ gridTemplateColumns: "minmax(220px,1fr) 88px minmax(220px,1fr) 120px 48px" }}>
                        <div className="truncate pr-2 font-medium">{row.name || "검사명"}</div>
                        <select className={inputSm} value={row.sex}
                                onChange={(e) => updateRow(activeGroup, row.examId, { sex: e.target.value as Sex })}>
                          <option value="A">전체</option><option value="M">남</option><option value="F">여</option>
                        </select>
                        <input className={inputSm} placeholder="비고" value={row.memo || ""}
                               onChange={(e) => updateRow(activeGroup, row.examId, { memo: e.target.value })}/>
                        <input className={inputSm} placeholder="코드" value={row.code || ""}
                               onChange={(e) => setCode(row.examId, e.target.value)}/>
                        <button className="px-2 text-xs text-gray-500 hover:text-gray-900" onClick={() => toggleExam(row.examId)}>삭제</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4 p-6">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">항목명</label>
                  <input className={input} value={addonName} onChange={(e) => setAddonName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">성별</label>
                  <select className={inputSm} value={addonSex} onChange={(e) => setAddonSex(e.target.value as any)}>
                    <option value="ALL">전체</option><option value="M">남</option><option value="F">여</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">비용(원)</label>
                  <input className={clsx(inputSm, "w-[140px] text-right")} inputMode="numeric"
                         value={addonPrice} onChange={(e) => setAddonPrice(e.target.value)} />
                </div>
                <button className={btn} onClick={addAddon}>추가</button>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-12 gap-0 bg-gray-50 px-3 py-2 text-xs">
                  <div className="col-span-7">항목명</div><div className="col-span-2">성별</div><div className="col-span-2 text-right">비용</div><div className="col-span-1"></div>
                </div>
                {draft.addons.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-gray-400">등록된 추가검사가 없습니다.</div>
                ) : draft.addons.map((a, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-0 border-t px-3 py-2 text-sm">
                    <div className="col-span-7">{a.name}</div>
                    <div className="col-span-2">{a.sex === "ALL" ? "전체" : a.sex === "M" ? "남" : "여"}</div>
                    <div className="col-span-2 text-right">{(a.price || 0).toLocaleString()}원</div>
                    <div className="col-span-1 text-right"><button className="text-xs text-gray-500 hover:text-red-600" onClick={() => removeAddon(i)}>삭제</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

