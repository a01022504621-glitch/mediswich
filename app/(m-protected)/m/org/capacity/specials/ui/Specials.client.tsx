"use client";

import { useEffect, useMemo, useState } from "react";

/* ───────────────── types ───────────────── */
type Special = { id: string; name: string };

type RowState = {
  editing: boolean;
  name: string;
  saving: boolean;
  deleting: boolean;
};

/* ───────────────── fetch helpers ───────────────── */
async function safeJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  try {
    return (await r.json()) as T;
  } catch {
    return {} as T;
  }
}

/* ───────────────── component ───────────────── */
export default function SpecialsEditor() {
  const [items, setItems] = useState<Special[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const count = items.length;

  const load = async () => {
    setLoading(true);
    try {
      const j = await safeJSON<{ items: Special[] }>("/api/capacity/settings/specials");
      const list = (Array.isArray(j?.items) ? j.items : []) as Special[];
      setItems(list.filter((x) => x && x.id && x.name));
      setRows((cur) => {
        const next: Record<string, RowState> = {};
        for (const it of list) {
          next[it.id] = cur[it.id] ?? { editing: false, name: it.name, saving: false, deleting: false };
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const canAdd = useMemo(
    () => newId.trim().length > 0 && newName.trim().length > 0 && !items.some((x) => x.id === newId.trim()),
    [items, newId, newName]
  );

  const onAdd = async () => {
    if (!canAdd) return;
    const id = sanitizeId(newId);
    const name = newName.trim();
    await fetch("/api/capacity/settings/specials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: { id, name } }),
    });
    setNewId("");
    setNewName("");
    await load();
  };

  const onDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    setRows((r) => ({ ...r, [id]: { ...(r[id] || { editing: false, name: "" }), deleting: true } }));
    await fetch("/api/capacity/settings/specials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeIds: [id] }),
    });
    await load();
  };

  const startEdit = (id: string) =>
    setRows((r) => ({ ...r, [id]: { ...(r[id] || { name: items.find((x) => x.id === id)?.name || "" }), editing: true, saving: false, deleting: false } }));

  const cancelEdit = (id: string) =>
    setRows((r) => ({ ...r, [id]: { ...(r[id] || { name: items.find((x) => x.id === id)?.name || "" }), editing: false } }));

  const saveEdit = async (id: string) => {
    const name = rows[id]?.name?.trim();
    if (!name) return;
    setRows((r) => ({ ...r, [id]: { ...(r[id] as RowState), saving: true } }));
    await fetch("/api/capacity/settings/specials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set: items.map((x) => (x.id === id ? { id, name } : x)) }),
    });
    await load();
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          등록된 특정검사 <b className="text-slate-900">{count}</b>개
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          disabled={loading}
        >
          새로고침
        </button>
      </div>

      {/* 추가 폼 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <input
          value={newId}
          onChange={(e) => setNewId(sanitizeId(e.target.value))}
          placeholder="아이디 (영문/숫자/_-)"
          className="w-48 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="표시 이름"
          className="w-72 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <button
          onClick={onAdd}
          disabled={!canAdd}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {/* 목록 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
          <div>이름</div>
          <div className="text-right pr-2">아이디</div>
          <div className="text-right pr-1">작업</div>
        </div>

        {items.map((it) => {
          const row = rows[it.id] || { editing: false, name: it.name, saving: false, deleting: false };
          return (
            <div key={it.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b px-3 py-2 last:border-b-0">
              <div>
                {row.editing ? (
                  <input
                    value={row.name}
                    onChange={(e) => setRows((r) => ({ ...r, [it.id]: { ...(r[it.id] || { editing: true }), name: e.target.value } }))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                ) : (
                  <span className="text-sm">{it.name}</span>
                )}
              </div>
              <div className="text-right font-mono text-[12px] text-slate-500 pr-2">{it.id}</div>
              <div className="flex items-center justify-end gap-1">
                {row.editing ? (
                  <>
                    <button
                      onClick={() => saveEdit(it.id)}
                      disabled={row.saving}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] hover:bg-slate-50 disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => cancelEdit(it.id)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] hover:bg-slate-50"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(it.id)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] hover:bg-slate-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => onDelete(it.id)}
                      disabled={row.deleting}
                      className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[12px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-500">등록된 항목이 없습니다.</div>
        )}
      </div>

      <p className="text-[12px] text-slate-500">
        ※ 여기서 등록한 “특정검사”는 <b>캘린더 상단의 드롭다운</b>에서 선택하여 일자별로 별도 마감/해제를 할 수 있습니다.
      </p>
    </div>
  );
}

/* ───────────────── utils ───────────────── */
function sanitizeId(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_\-\.]/g, "");
}
