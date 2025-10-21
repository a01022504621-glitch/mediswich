// app/(m-protected)/m/org/capacity/ui/Defaults.client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

/** ───────── types ───────── */
type DefaultsCore = { BASIC: number; SPECIAL: number }; // NHIS 제거(하위호환 전송만)
type Special = { id: string; name: string };

type SettingsDTO = {
  specials: string[]; // unused
  defaults: Partial<DefaultsCore> & { NHIS?: number }; // 하위호환 로드용
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

  const [defaults, setDefaults] = useState<DefaultsCore>({ BASIC: 40, SPECIAL: 12 });
  const [legacyNHIS, setLegacyNHIS] = useState<number>(0); // 서버 하위호환 전달용

  // 특정검사 목록은 “특정검사설정”에서 등록된 것만 보여준다.
  const [examItems, setExamItems] = useState<Special[]>([]);
  // 각 항목의 기본 케파 값
  const [examDefaults, setExamDefaults] = useState<Record<string, number>>({});

  // 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await safeJSON<SettingsDTO>("/api/capacity/settings/defaults");
        if (s?.defaults) {
          setDefaults({
            BASIC: Number(s.defaults.BASIC ?? 40),
            SPECIAL: Number(s.defaults.SPECIAL ?? 12),
          });
          setLegacyNHIS(Number(s.defaults.NHIS ?? 0));
        }
        if (s?.examDefaults) setExamDefaults(s.examDefaults);

        const sp = await safeJSON<{ items: Special[] }>("/api/capacity/settings/specials");
        const items = Array.isArray(sp?.items) ? sp.items : [];
        setExamItems(items);

        // 목록에 없는 키는 즉시 제거하여 하드코딩 표시 방지
        setExamDefaults((prev) => {
          const allowed = new Set(items.map((i) => i.id));
          const next: Record<string, number> = {};
          for (const [k, v] of Object.entries(prev || {})) if (allowed.has(k)) next[k] = v;
          return next;
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 화면에 표시할 로우: 등록된 특정검사 목록만 기준으로 생성
  const rows = useMemo(
    () =>
      examItems.map((s) => ({
        id: s.id,
        name: s.name || s.id,
        value: examDefaults[s.id] ?? 0,
      })),
    [examItems, examDefaults],
  );

  const setDef = (key: keyof DefaultsCore, val: number) =>
    setDefaults((d) => ({ ...d, [key]: Math.max(0, Math.floor(val || 0)) }));

  const setExam = (id: string, val: number) =>
    setExamDefaults((m) => ({ ...m, [id]: Math.max(0, Math.floor(val || 0)) }));

  // “삭제”는 행 제거가 아니라 값을 0으로 초기화
  const resetExam = (id: string) => setExamDefaults((m) => ({ ...m, [id]: 0 }));

  const save = async () => {
    setSaving(true);
    try {
      // 목록에 존재하는 항목만 저장
      const payloadExamDefaults = Object.fromEntries(
        examItems.map((i) => [i.id, Math.max(0, Math.floor(examDefaults[i.id] || 0))]),
      );

      await fetch("/api/capacity/settings/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaults: { BASIC: defaults.BASIC, SPECIAL: defaults.SPECIAL, NHIS: legacyNHIS },
          examDefaults: payloadExamDefaults,
        }),
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
      {/* 기본 케파 */}
      <section className="rounded-2xl border p-4 shadow-sm bg-white">
        <h2 className="text-sm font-semibold mb-3">기본 케파 설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-slate-600 mb-1">기본 케파</div>
            <input
              type="number"
              min={0}
              value={defaults.BASIC}
              onChange={(e) => setDef("BASIC", Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-600 mb-1">특수검진 케파</div>
            <input
              type="number"
              min={0}
              value={defaults.SPECIAL}
              onChange={(e) => setDef("SPECIAL", Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          지정한 인원을 초과하면 해당 리소스는 자동 마감됩니다. 달력 카드에는 “예약자수/케파”가 표시됩니다.
        </p>
      </section>

      {/* 특정검사 케파 */}
      <section className="rounded-2xl border p-4 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">특정검사 케파설정</h2>
          <button
            onClick={() => {
              // 목록 값들을 그대로 다시 덮어써 동기화
              const map: Record<string, number> = {};
              for (const s of examItems) map[s.id] = examDefaults[s.id] ?? 0;
              setExamDefaults(map);
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
              {rows.map((row) => (
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
                      onClick={() => resetExam(row.id)}
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-rose-50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
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



