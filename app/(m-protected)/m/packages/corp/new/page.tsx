"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** === 단일 소스: 고객사 레지스트리 표준 키 === */
const CANON_KEY = "ms_clients_v2";

function migrateLegacyClientsOnce() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(CANON_KEY)) return;
  const legacyKeys = [
    "ms_clients",
    "m_clients",
    "clients",
    "mediswitch_clients",
    "ms_customers",
    "customers",
    "corp_clients",
    "m_corp_list",
  ];
  let hit: any[] | null = null;
  for (const k of legacyKeys) {
    try {
      const v = localStorage.getItem(k);
      if (!v) continue;
      const arr = JSON.parse(v);
      if (Array.isArray(arr) && arr.length) {
        hit = arr;
        break;
      }
    } catch {}
  }
  if (!hit) return;
  const norm = hit
    .map((o) => {
      const id = (o.corpCode ?? o.code ?? o.id ?? "").toString().trim();
      const name = (o.corpName ?? o.name ?? o.company ?? o.title ?? "")
        .toString()
        .trim();
      return { id, name };
    })
    .filter((c) => c.id && c.name);
  const uniq = Array.from(new Map(norm.map((c) => [c.id, c])).values());
  if (uniq.length) localStorage.setItem(CANON_KEY, JSON.stringify(uniq));
}

function loadClientsFromRegistry(): { id: string; name: string }[] {
  if (typeof window === "undefined") return [];
  migrateLegacyClientsOnce();
  try {
    const v = localStorage.getItem(CANON_KEY);
    const arr = v ? JSON.parse(v) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c: any) => c && c.id && c.name)
      .map((c: any) => ({ id: String(c.id), name: String(c.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  } catch {
    return [];
  }
}

/** 간단 빌더 항목 타입(데모) */
type BuilderItem = {
  id: string;
  name: string;
  gender: "전체" | "남" | "여";
  memo?: string;
  code?: string;
};

export default function CorpPackageEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const editingId = params.get("id");

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [corpId, setCorpId] = useState("");
  const [name, setName] = useState("기업검진 패키지(예시)");
  const [price, setPrice] = useState<number>(0);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [expose, setExpose] = useState(true);

  const [tab, setTab] = useState<"basic" | "optA">("basic");
  const [basic, setBasic] = useState<BuilderItem[]>([]);
  const [optA, setOptA] = useState<BuilderItem[]>([]);
  const selectedCount = useMemo(
    () => (tab === "basic" ? basic.length : optA.length),
    [tab, basic, optA]
  );

  useEffect(() => {
    setClients(loadClientsFromRegistry());
  }, []);

  // 수정 모드: 데모 저장소에서 불러오기
  useEffect(() => {
    if (!editingId || typeof window === "undefined") return;
    try {
      const arr = JSON.parse(
        localStorage.getItem("corp_packages_demo") ?? "[]"
      );
      const row = (arr as any[]).find((x) => x.id === editingId);
      if (!row) return;
      setCorpId(row.corpId);
      setName(row.name);
      setPrice(row.price);
      setStart(row.start);
      setEnd(row.end);
      setExpose(row.expose);
      setBasic(row.basic ?? []);
      setOptA(row.optA ?? []);
    } catch {}
  }, [editingId]);

  /** 항목 추가(데모: 왼쪽 리스트 없이 빠르게 추가 버튼으로 대체) */
  function addItem() {
    const next: BuilderItem = {
      id: crypto.randomUUID(),
      name: `검사항목 ${selectedCount + 1}`,
      gender: "전체",
    };
    if (tab === "basic") setBasic((prev) => [...prev, next]);
    else setOptA((prev) => [...prev, next]);
  }

  function removeItem(id: string) {
    if (tab === "basic") setBasic((prev) => prev.filter((x) => x.id !== id));
    else setOptA((prev) => prev.filter((x) => x.id !== id));
  }

  /** 저장 유효성 체크 */
  function validate() {
    if (!corpId) return "고객사를 선택해 주세요.";
    if (!start || !end) return "유효 시작일/종료일을 입력해 주세요.";
    if (basic.length + optA.length < 1)
      return "최소 1개 이상의 검사 항목이 필요합니다.";
    return null;
  }

  function handleSave() {
    const msg = validate();
    if (msg) {
      alert(msg);
      return;
    }
    const payload = {
      id: editingId ?? crypto.randomUUID(),
      corpId,
      corpName: clients.find((c) => c.id === corpId)?.name ?? "",
      name,
      price,
      start,
      end,
      expose,
      groups: 1 + (optA.length ? 1 : 0),
      basic,
      optA,
    };

    const storeKey = "corp_packages_demo";
    const prev = JSON.parse(localStorage.getItem(storeKey) ?? "[]");
    let next: any[] = Array.isArray(prev) ? prev : [];
    if (editingId) {
      next = next.map((x) => (x.id === editingId ? payload : x));
    } else {
      next.push(payload);
    }
    localStorage.setItem(storeKey, JSON.stringify(next));
    alert("저장되었습니다.");
    router.push("/m/packages/corp"); // 목록으로
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          기업검진 패키지 {editingId ? "수정" : "추가"}
        </h1>
        <div className="space-x-2">
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => router.push("/m/packages/corp")}
          >
            목록으로
          </button>
          <button
            className="rounded-md bg-black text-white px-3 py-2 text-sm"
            onClick={handleSave}
          >
            저장
          </button>
        </div>
      </div>

      {/* 기본 정보 */}
      <section className="rounded-xl border bg-white p-4 space-y-4">
        <div className="text-sm font-medium">패키지 기본 정보</div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="col-span-2 flex items-center gap-2">
            <label className="w-20 shrink-0 text-sm text-gray-600">고객사</label>
            <select
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={corpId}
              onChange={(e) => setCorpId(e.target.value)}
            >
              <option value="">고객사 선택</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <label className="w-20 shrink-0 text-sm text-gray-600">패키지명</label>
            <input
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="패키지명"
            />
          </div>

          <div className="col-span-1 flex items-center gap-2">
            <label className="w-20 shrink-0 text-sm text-gray-600">표시 금액</label>
            <input
              type="number"
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value || 0))}
              min={0}
            />
          </div>

          <div className="col-span-1 flex items-center gap-2">
            <label className="w-20 shrink-0 text-sm text-gray-600">
              유효 시작일
            </label>
            <input
              type="date"
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="col-span-1 flex items-center gap-2">
            <label className="w-20 shrink-0 text-sm text-gray-600">
              유효 종료일
            </label>
            <input
              type="date"
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>

          <div className="col-span-1 flex items-center gap-2">
            <label className="w-20 shrink-0 text-sm text-gray-600">노출</label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={expose}
                onChange={(e) => setExpose(e.target.checked)}
              />
              예약자페이지 노출
            </label>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          ※ 고객사 선택, 유효기간(시작/종료) 입력 및 모든 빌더 그룹에 최소 1개 이상의
          검사가 필요합니다.
        </p>
      </section>

      {/* 패키지 빌더 */}
      <section className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className={`rounded-full px-3 py-1.5 text-sm ${
                tab === "basic"
                  ? "bg-black text-white"
                  : "border text-gray-700 bg-white"
              }`}
              onClick={() => setTab("basic")}
            >
              기본검사 {basic.length}건
            </button>
            <button
              className={`rounded-full px-3 py-1.5 text-sm ${
                tab === "optA"
                  ? "bg-black text-white"
                  : "border text-gray-700 bg-white"
              }`}
              onClick={() => setTab("optA")}
            >
              선택검사 A {optA.length}건 · 필수 1
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-3 py-1.5 text-sm"
              onClick={addItem}
            >
              + 항목 추가
            </button>
            <button
              className="rounded-md border bg-red-50 px-3 py-1.5 text-sm text-red-600"
              onClick={() => (tab === "basic" ? setBasic([]) : setOptA([]))}
            >
              전체 비우기
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {(tab === "basic" ? basic : optA).map((it) => (
            <div
              key={it.id}
              className="grid grid-cols-[1fr_90px_1fr_140px_64px] items-center gap-2 rounded-md border p-2"
            >
              <div className="text-sm">{it.name}</div>
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={it.gender}
                onChange={(e) => {
                  const v = e.target.value as BuilderItem["gender"];
                  if (tab === "basic") {
                    setBasic((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, gender: v } : x))
                    );
                  } else {
                    setOptA((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, gender: v } : x))
                    );
                  }
                }}
              >
                <option>전체</option>
                <option>남</option>
                <option>여</option>
              </select>
              <input
                className="h-9 rounded-md border px-2 text-sm"
                placeholder="비고"
                value={it.memo ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (tab === "basic") {
                    setBasic((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, memo: v } : x))
                    );
                  } else {
                    setOptA((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, memo: v } : x))
                    );
                  }
                }}
              />
              <input
                className="h-9 rounded-md border px-2 text-sm"
                placeholder="코드(병원 전산용)"
                value={it.code ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (tab === "basic") {
                    setBasic((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, code: v } : x))
                    );
                  } else {
                    setOptA((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, code: v } : x))
                    );
                  }
                }}
              />
              <button
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => removeItem(it.id)}
              >
                삭제
              </button>
            </div>
          ))}
          {(tab === "basic" ? basic : optA).length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
              좌측 목록(또는 ‘+ 항목 추가’)으로 항목을 추가해 주세요.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
