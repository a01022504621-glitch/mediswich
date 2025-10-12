// app/(m-protected)/m/vaccines/items/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  VaccineItem,
  listVaccines,
  saveVaccine,
  removeVaccine,
  SUGGEST_GENERAL,
  SUGGEST_FLU,
} from "@/lib/vaccineAdminStore";

type SectionKey = "GENERAL" | "FLU";

const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const asInt = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const asMoney = (v: any) => {
  const num = Number(String(v || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : 0;
};

export default function VaccinesAdminItemsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const tabParam = (search.get("tab") as SectionKey) || "GENERAL";
  const [section, setSection] = useState<SectionKey>(tabParam);

  useEffect(() => {
    if (tabParam !== section) setSection(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const setTab = useCallback((next: SectionKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    router.replace(url.pathname + "?" + url.searchParams.toString());
    setSection(next);
  }, [router]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">백신 관리</h1>
          <p className="text-sm text-gray-500">일반 백신과 독감(인플루엔자)을 분리 관리합니다. (데모: localStorage)</p>
        </div>
        <nav className="flex gap-2">
          <button
            className={clsx("px-3 py-1.5 rounded-lg border text-sm", section === "GENERAL" && "bg-gray-900 text-white")}
            onClick={() => setTab("GENERAL")}
          >
            일반 백신
          </button>
          <button
            className={clsx("px-3 py-1.5 rounded-lg border text-sm", section === "FLU" && "bg-gray-900 text-white")}
            onClick={() => setTab("FLU")}
          >
            독감(인플루엔자)
          </button>
        </nav>
      </header>

      <Section kind={section} />
    </div>
  );
}

function Section({ kind }: { kind: SectionKey }) {
  const [items, setItems] = useState<VaccineItem[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<VaccineItem> | null>(null);

  const refresh = useCallback(() => {
    try {
      setItems(listVaccines(kind));
    } catch {
      setItems([]);
    }
  }, [kind]);

  useEffect(() => {
    refresh();
    setEditing(null);
  }, [kind, refresh]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(v => [v.drugName, v.manufacturer, v.notes].join(" ").toLowerCase().includes(s));
  }, [items, q]);

  function startNew(prefill?: { drugName?: string; manufacturer?: string }) {
    setEditing({
      kind: kind as VaccineItem["kind"],
      drugName: prefill?.drugName ?? "",
      manufacturer: prefill?.manufacturer ?? "",
      price: 0,
      doseCount: 1,
      active: true,
      periodStart: "",
      periodEnd: "",
      notes: "",
    });
  }

  function save() {
    const name = (editing?.drugName ?? "").trim();
    if (!name) return alert("약품명은 필수입니다.");

    const now = new Date().toISOString();
    const payload: VaccineItem = {
      ...(editing?.id ? { id: editing.id } : { id: "" }),
      kind: kind as VaccineItem["kind"],
      drugName: name,
      manufacturer: (editing?.manufacturer ?? "").trim(),
      price: asMoney(editing?.price ?? 0),
      doseCount: Math.max(1, asInt(editing?.doseCount ?? 1, 1)),
      active: !!editing?.active,
      periodStart: String(editing?.periodStart ?? ""),
      periodEnd: String(editing?.periodEnd ?? ""),
      notes: (editing?.notes ?? "").trim(),
      createdAt: (editing as any)?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      const saved = saveVaccine(payload);
      setItems(listVaccines(kind));
      setEditing(saved);
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  function del(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      removeVaccine(id);
      setItems(listVaccines(kind));
      setEditing(null);
    } catch {
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  const suggestions = useMemo(() => (kind === "GENERAL" ? SUGGEST_GENERAL : SUGGEST_FLU), [kind]);

  return (
    <div className="grid md:grid-cols-5 gap-6">
      <div className="md:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <input
            className="border rounded-lg px-3 py-2 text-sm w-64"
            placeholder={`${kind === "GENERAL" ? "일반 백신" : "독감"} 검색(약품/제약사/비고)`}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-lg border text-sm" onClick={() => startNew()}>
              + 새로 등록
            </button>
          </div>
        </div>

        <div className="border rounded-xl p-3">
          <div className="text-xs font-semibold mb-2">빠른 추가(추천)</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(([drug, maker], i) => (
              <button
                key={i}
                onClick={() => startNew({ drugName: drug, manufacturer: maker })}
                className="px-2.5 py-1.5 text-xs rounded-lg border hover:bg-gray-50"
              >
                {drug}{maker ? ` • ${maker}` : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="border rounded-xl p-6 text-gray-500 text-sm" aria-live="polite">
              등록된 항목이 없습니다. 우측에서 추가하거나, 위 추천을 눌러 빠르게 작성하세요.
            </div>
          )}
          {filtered.map(v => (
            <div key={v.id} className="border rounded-xl p-4 flex items-center justify-between hover:shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{v.drugName}</span>
                  {v.active ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">진행</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">중지</span>
                  )}
                  {!!v.doseCount && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{v.doseCount}회</span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {v.manufacturer ? `${v.manufacturer} • ` : ""}비용 {Number(v.price || 0).toLocaleString()}원
                  {v.periodStart && v.periodEnd ? ` • 기간 ${v.periodStart} ~ ${v.periodEnd}` : ""}
                </div>
                {v.notes && <div className="text-xs text-gray-600 mt-1">{v.notes}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(v)} className="px-2.5 py-1.5 text-sm rounded-lg border">수정</button>
                <button onClick={() => del(v.id)} className="px-2.5 py-1.5 text-sm rounded-lg border text-red-600">삭제</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{kind === "GENERAL" ? "일반 백신" : "독감"} 등록/수정</h2>
            {editing?.id && <span className="text-xs text-gray-500">ID: {String(editing.id).slice(0, 8)}…</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1">약품명*</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={editing?.drugName ?? ""}
                onChange={e => setEditing(s => ({ ...(s || {}), drugName: e.target.value }))}
                placeholder="예) Shingrix"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">제약사</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={editing?.manufacturer ?? ""}
                onChange={e => setEditing(s => ({ ...(s || {}), manufacturer: e.target.value }))}
                placeholder="예) GSK"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">비용(원)*</label>
              <input
                inputMode="numeric"
                className="w-full border rounded-lg px-3 py-2 text-sm text-right"
                value={editing?.price ?? 0}
                onChange={e => setEditing(s => ({ ...(s || {}), price: asMoney(e.target.value) }))}
                placeholder="숫자만 입력"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">회차</label>
              <input
                type="number"
                min={1}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={editing?.doseCount ?? 1}
                onChange={e => setEditing(s => ({ ...(s || {}), doseCount: Math.max(1, asInt(e.target.value, 1)) }))}
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input
                id={`active-${kind}`}
                type="checkbox"
                className="w-4 h-4"
                checked={!!editing?.active}
                onChange={e => setEditing(s => ({ ...(s || {}), active: e.target.checked }))}
              />
              <label htmlFor={`active-${kind}`} className="text-sm">판매/예약 진행</label>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">접종기간(시작)</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={editing?.periodStart ?? ""}
                onChange={e => setEditing(s => ({ ...(s || {}), periodStart: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">접종기간(종료)</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={editing?.periodEnd ?? ""}
                onChange={e => setEditing(s => ({ ...(s || {}), periodEnd: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1">비고/안내</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={editing?.notes ?? ""}
                onChange={e => setEditing(s => ({ ...(s || {}), notes: e.target.value }))}
                placeholder="보관/접종 주의사항 등"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">저장</button>
            {editing?.id && (
              <button onClick={() => del(editing.id!)} className="px-3 py-2 rounded-lg border text-sm text-red-600">
                삭제
              </button>
            )}
          </div>
        </div>

        <div className="border rounded-2xl p-4 mt-6 text-xs text-gray-600 leading-5">
          <b>TIP.</b> 지금은 데모 저장(localStorage)입니다. 배포 전에는 Prisma 모델(예: <code>VaccineItem</code>)을 만들고
          <br />이 페이지의 저장/조회 로직을 <code>/api</code> 라우트로 교체하세요.
        </div>
      </div>
    </div>
  );
}



