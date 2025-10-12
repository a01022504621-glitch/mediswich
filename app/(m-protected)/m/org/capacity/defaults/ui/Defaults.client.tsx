"use client";

import { useEffect, useMemo, useState } from "react";

/** ───────── types ───────── */
type Defaults = { BASIC: number; NHIS: number; SPECIAL: number };
type Special = { id: string; name: string };

type SettingsDTO = {
  specials: string[]; // (레거시 표시용) 사용 안 함
  defaults: Defaults;
  examDefaults: Record<string, number>;
};

/** ───────── helpers ───────── */
async function safeJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  try {
    return (await r.json()) as T;
  } catch {
    return {} as T;
  }
}

export default function DefaultsEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [defaults, setDefaults] = useState<Defaults>({ BASIC: 40, NHIS: 20, SPECIAL: 12 });
  const [examDefaults, setExamDefaults] = useState<Record<string, number>>({});
  const [examItems, setExamItems] = useState<Special[]>([]);

  // 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await safeJSON<SettingsDTO>("/api/capacity/settings/defaults");
        if (s?.defaults) setDefaults(s.defaults);
        if (s?.examDefaults) setExamDefaults(s.examDefaults);

        const sp = await safeJSON<{ items: Special[] }>("/api/capacity/settings/specials");
        setExamItems(Array.isArray(sp?.items) ? sp.items : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // specials 목록에 있는데 examDefaults에 키가 없으면 0으로 보이도록 메모
  const mergedExamRows = useMemo(() => {
    const map = new Map<string, number>(Object.entries(examDefaults || {}));
    for (const s of examItems) if (!map.has(s.id)) map.set(s.id, 0);
    return Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: examItems.find((x) => x.id === id)?.name || id,
      value: v || 0,
    }));
  }, [examDefaults, examItems]);

  const setDef = (key: keyof Defaults, val: number) =>
    setDefaults((d) => ({ ...d, [key]: Math.max(0, Math.floor(val || 0)) }));

  const setExam = (id: string, val: number) =>
    setExamDefaults((m) => ({ ...m, [id]: Math.max(0, Math.floor(val || 0)) }));

  const removeExam = (id: string) =>
    setExamDefaults((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/capacity/settings/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults, examDefaults }),
      });
      alert("저장되었습니다.");
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border p-4 text-sm text-slate-500">불러오는 중…</div>;
  }

  return (
    <div className="space-y-6">
      {/* 일자 합산 기준 기본 케파 */}
      <section className="rounded-2xl border p-4 shadow-sm bg-white">
        <h2 className="text-sm font-semibold mb-3">리소스별 기본 수용 인원</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["BASIC", "NHIS", "SPECIAL"] as const).map((k) => (
            <label key={k} className="block">
              <div className="text-xs text-slate-600 mb-1">
                {k === "BASIC" ? "기본(BASIC)" : k === "NHIS" ? "공단(NHIS)" : "특수/특정(SPECIAL)"}
              </div>
              <input
                type="number"
                min={0}
                value={defaults[k]}
                onChange={(e) => setDef(k, Number(e.target.value))}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          요일별 시간대 템플릿의 슬롯 cap 합으로 일일 수용 인원을 계산합니다. 템플릿이 없을 때는 여기 설정값을
          참고할 수 있도록 백엔드에 반영되어 있습니다.
        </p>
      </section>

      {/* 특정검사(개별) 기본 케파 */}
      <section className="rounded-2xl border p-4 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">특정검사별 기본 수용 인원</h2>
          <button
            onClick={() => {
              // specials에 등록된 항목을 모두 행으로 채우되, 비어있는 항목은 0으로
              const add: Record<string, number> = {};
              for (const s of examItems) add[s.id] = examDefaults[s.id] ?? 0;
              setExamDefaults((m) => ({ ...add, ...m }));
            }}
            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            목록 동기화
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-3 py-2 w-[56%]">항목</th>
                <th className="text-right px-3 py-2 w-[24%]">기본 인원</th>
                <th className="px-3 py-2 w-[20%] text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {mergedExamRows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{row.name}</div>
                    <div className="text-[11px] text-slate-400">{row.id}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={examDefaults[row.id] ?? 0}
                      onChange={(e) => setExam(row.id, Number(e.target.value))}
                      className="w-28 rounded-lg border px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeExam(row.id)}
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-rose-50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {mergedExamRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                    등록된 특정검사가 없습니다. 상단 “특정검사 설정”에서 먼저 항목을 추가하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}


