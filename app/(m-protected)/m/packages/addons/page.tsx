// app/(m-protected)/m/packages/addons/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { loadCodes, saveCodes } from "@/lib/examStore";

const ClientSelect = dynamic(() => import("../corp/_components/ClientSelect.client"), { ssr: false });
const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Sex = "A" | "M" | "F";
type ExcelRow = { 카테고리?: string; 검진세부항목?: string; 검사명?: string };
type Exam = { id: string; category: string; detail: string; name: string };
type Client = { id: string; name: string };

function stableId(category: string, detail: string, name: string) {
  const key = [category, detail, name].map((s) => (s || "").trim().toLowerCase()).join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return "ex_" + h.toString(36);
}

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

const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const card = "bg-white shadow-sm rounded-2xl border border-gray-200";
const subHead = "px-6 py-3 text-sm font-semibold text-gray-700 border-b";
const body = "px-6 py-6";
const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const inputSm = "w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const btn = "px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50";
const btnPrimary = "px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:opacity-90";

type Addon = {
  id?: string;
  name: string;
  sex: Sex;
  price: number | null;
  visible: boolean;
  clientId: string | null;
  code?: string | null; // ← 코드 필드 추가
};

export default function AddonManagePage() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  // 고객사 목록
  const { data: clientResp } = useSWR<{ items: Client[] }>(
    "/api/clients?take=200",
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
  const clients: Client[] = clientResp?.items ?? [];

  // 엑셀 로딩
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [excelErr, setExcelErr] = useState<string | null>(null);
  useEffect(() => {
    loadExcel().then(setAllExams).catch((e) => setExcelErr(e.message)).finally(() => setLoading(false));
  }, []);

  // 코드맵 + 서버 오버라이드 병합(글로벌 네임스페이스)
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [overrideMap, setOverrideMap] = useState<Record<string, { code?: string; sex?: Sex }>>({});
  useEffect(() => {
    const base = loadCodes();
    setCodeMap(base);
    (async () => {
      try {
        const r = await fetch("/api/m/exams/overrides", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json().catch(() => null as any);
        const map = (j?.map || {}) as Record<string, { code?: string; sex?: Sex }>;
        setOverrideMap(map);
        const merged = { ...base };
        for (const [k, v] of Object.entries(map)) if (v?.code) merged[k] = v.code!;
        setCodeMap(merged);
        saveCodes(merged);
      } catch {}
    })();
  }, []);

  const setCode = (examId: string, code: string) => {
    setCodeMap((prev) => {
      const next = { ...prev, [examId]: code };
      saveCodes(next);
      return next;
    });
  };

  // 선택된 고객사 (""=전체 보기, null=공통 저장)
  const [targetClient, setTargetClient] = useState<string>("");
  const currentClientId = targetClient || null;

  // 서버 목록
  const { data: listResp, mutate } = useSWR<{ ok: boolean; items: Addon[] }>(
    () => (ready ? `/api/m/addons${currentClientId ? `?clientId=${currentClientId}` : ""}` : null),
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
  const items: Addon[] = listResp?.items ?? [];

  // 좌측 검색/필터
  const cats = useMemo(() => ["전체", ...Array.from(new Set(allExams.map(e => e.category).filter(Boolean)))], [allExams]);
  const [cat, setCat] = useState("전체");
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allExams.filter(e => (cat === "전체" || e.category === cat) && (!s || e.name.toLowerCase().includes(s) || e.detail.toLowerCase().includes(s)));
  }, [allExams, cat, q]);

  // Excel 선택 연동용 examId
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  // 신규 추가/수정 폼
  const [form, setForm] = useState<Addon>({ name: "", sex: "A", price: null, visible: true, clientId: null, code: "" });
  useEffect(() => { setForm((f) => ({ ...f, clientId: currentClientId })); }, [currentClientId]);

  const upsertOverride = async (examId: string, code: string | null) => {
    try {
      await fetch("/api/m/exams/overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updates: [{ examId, code: (code || "").trim() || null }] }),
      });
    } catch {}
  };

  const submit = async () => {
    if (!form.name.trim()) return alert("항목명을 입력해 주세요.");
    const res = await fetch("/api/m/addons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: form.id || undefined,
        name: form.name.trim(),
        sex: form.sex,
        price: typeof form.price === "number" ? form.price : null,
        visible: form.visible,
        clientId: currentClientId,
        code: (form.code || "").trim() || null,
      }),
    }).then(r => r.json());
    if (!res.ok) return alert(res.error || "저장 실패");

    // Excel에서 선택된 항목이었다면 글로벌 코드맵 및 오버라이드 동기화
    if (selectedExamId) {
      const c = (form.code || "").trim();
      setCode(selectedExamId, c);
      await upsertOverride(selectedExamId, c || null);
    }

    setForm({ name: "", sex: "A", price: null, visible: true, clientId: currentClientId, code: "" });
    setSelectedExamId(null);
    mutate();
  };

  const editRow = (r: Addon) => {
    setForm({ ...r, code: r.code ?? "" });
    setSelectedExamId(null); // DB 레코드엔 examId가 없으므로 코드맵은 건드리지 않음
  };

  const delRow = async (id: string) => {
    if (!confirm("해당 추가검사를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/m/addons/${id}`, { method: "DELETE" }).then(r => r.json());
    if (!res.ok) return alert(res.error || "삭제 실패");
    mutate();
  };

  const bulkClear = async () => {
    if (!confirm(`${currentClientId ? "해당 고객사 전용" : "공통"} 추가검사를 모두 삭제할까요?`)) return;
    const url = `/api/m/addons${currentClientId ? `?clientId=${currentClientId}` : ""}`;
    const res = await fetch(url, { method: "DELETE" }).then(r => r.json());
    if (!res.ok) return alert(res.error || "삭제 실패");
    mutate();
  };

  return (
    <div className="p-5 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-sky-600">추가검사</span> 항목 등록
        </h1>
      </div>

      {/* 상단 컨트롤 */}
      <section className={card}>
        <div className={subHead}>저장 대상</div>
        <div className={body + " flex items-center gap-4 flex-wrap"}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">고객사</span>
            <div className="w-[260px]">
              <ClientSelect
                name="clientId"
                value={targetClient ?? ""}     
                placeholder="전체(공통)"
                onChange={(id) => setTargetClient(id)}
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className={btn} onClick={bulkClear}>목록 전체 삭제</button>
          </div>
        </div>
      </section>

      {/* 2열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌: 검사항목 리스트 */}
        <section className={clsx(card, "lg:col-span-6")}>
          <div className={subHead}>검사항목 리스트</div>
          <div className={body + " space-y-3"}>
            <div className="flex items-center gap-2 flex-wrap">
              {cats.map(c => (
                <button key={c} onClick={() => setCat(c)}
                        className={clsx("px-3 py-1.5 rounded-full text-xs border transition",
                          c === cat ? "bg-sky-600 text-white border-sky-600 shadow-sm" : "border-gray-300 hover:bg-gray-50")}>
                  {c}
                </button>
              ))}
              <div className="flex-1" />
              <input className={clsx(input, "max-w-xs")} placeholder="검사명/세부항목 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {loading && <div className="text-gray-500 text-sm">엑셀을 불러오는 중…</div>}
            {excelErr && <div className="text-red-600 text-sm">엑셀 오류: {excelErr}</div>}

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {filtered.map(e => (
                <div key={e.id}
                     className="w-full rounded-lg border px-3 py-2 mb-2 transition flex items-center gap-2 border-gray-200">
                  <button
                    className="flex-1 text-left hover:opacity-80"
                    onClick={() => {
                      setForm((f) => ({ ...f, name: e.name, code: codeMap[e.id] || "" }));
                      setSelectedExamId(e.id);
                    }}
                  >
                    <div className="truncate text-sm">{e.name}</div>
                    <div className="text-[11px] text-gray-400">{e.detail}</div>
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-gray-500">코드</span>
                    <input
                      className={clsx(inputSm, "w-[120px]")}
                      value={codeMap[e.id] || ""}
                      onChange={(ev) => {
                        setCode(e.id, ev.target.value);
                        if (selectedExamId === e.id) setForm((f) => ({ ...f, code: ev.target.value }));
                      }}
                      placeholder="선택"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 우: 추가검사 등록/목록 */}
        <section className={clsx(card, "lg:col-span-6")}>
          <div className={subHead}>추가검사 등록</div>
          <div className={body + " space-y-4"}>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">항목명</label>
                <input className={input} value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">성별</label>
                <select className={inputSm} value={form.sex} onChange={(e)=>setForm({...form, sex: e.target.value as Sex})}>
                  <option value="A">전체</option><option value="M">남</option><option value="F">여</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">비용(원)</label>
                <input className={clsx(inputSm, "text-right")} inputMode="numeric"
                       value={form.price ?? ""} onChange={(e)=> {
                         const v = e.target.value.replace(/[^0-9]/g,"");
                         setForm({...form, price: v===""?null:Number(v)});
                       }}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">코드</label>
                <input
                  className={inputSm}
                  value={form.code ?? ""}
                  onChange={(e) => {
                    setForm({ ...form, code: e.target.value });
                    if (selectedExamId) setCode(selectedExamId, e.target.value);
                  }}
                  placeholder="선택(Excel에서 항목 선택 시 자동 채움)"
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-sky-600 scale-110"
                     checked={form.visible} onChange={(e)=>setForm({...form, visible:e.target.checked})}/>
              예약자페이지 노출
            </label>
            <div className="flex gap-2">
              <button className={btnPrimary} onClick={submit}>{form.id ? "수정" : "추가"}</button>
              {form.id && (
                <button className={btn} onClick={()=>{ setForm({ name:"", sex:"A", price:null, visible:true, clientId: currentClientId, code: "" }); setSelectedExamId(null); }}>새로 입력</button>
              )}
            </div>

            <div className="mt-6 rounded-xl border overflow-hidden">
              <div className="grid grid-cols-12 gap-0 text-xs bg-gray-50 px-3 py-2">
                <div className="col-span-5">항목명</div>
                <div className="col-span-1">성별</div>
                <div className="col-span-2 text-right">비용</div>
                <div className="col-span-2">코드</div>
                <div className="col-span-1 text-center">노출</div>
                <div className="col-span-1" />
              </div>
              {(items || []).length === 0 ? (
                <div className="px-3 py-6 text-sm text-gray-400">등록된 추가검사가 없습니다.</div>
              ) : items.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-0 items-center px-3 py-2 border-t text-sm">
                  <div className="col-span-5 truncate">{r.name}</div>
                  <div className="col-span-1">{r.sex==="A"?"전체":r.sex==="M"?"남":"여"}</div>
                  <div className="col-span-2 text-right">{(r.price || 0).toLocaleString()}원</div>
                  <div className="col-span-2 truncate">{r.code ?? "-"}</div>
                  <div className="col-span-1 text-center">{r.visible ? "노출" : "숨김"}</div>
                  <div className="col-span-1 text-right flex items-center justify-end gap-2">
                    <button className={btn} onClick={()=>editRow(r)}>수정</button>
                    <button className="px-3 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50"
                            onClick={()=> delRow(r.id!)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}



