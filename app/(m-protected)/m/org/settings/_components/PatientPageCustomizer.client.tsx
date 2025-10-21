"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PatientPageConfig } from "@/lib/patient-page/render";

/* ───────── 기본값/보정 ───────── */
const DEFAULT_CFG: PatientPageConfig = {
  themePreset: "modern",
  colors: { bg: "#EEF4FF", fg: "#0F172A", accent: "#3B82F6" },
  logoUrl: null,
  titleLines: ["고고병원 빠른 예약 서비스"],
  titleColor: "#0F172A",
  notices: [],
  background: { type: "solid", color1: "#F9FAFB" },
};

function isHex(x?: string) {
  return typeof x === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(x);
}
function oneOf<T extends string>(v: any, arr: readonly T[]): T | undefined {
  return arr.includes(v) ? (v as T) : undefined;
}

function normalize(x: any): PatientPageConfig {
  const base = { ...DEFAULT_CFG };
  if (!x || typeof x !== "object") return base;

  const themePreset =
    oneOf(x.themePreset, ["modern", "warm", "trust", "classic"]) ?? base.themePreset;

  const colors = {
    bg: isHex(x?.colors?.bg) ? x.colors.bg : base.colors.bg,
    fg: isHex(x?.colors?.fg) ? x.colors.fg : base.colors.fg,
    accent: isHex(x?.colors?.accent) ? x.colors.accent : base.colors.accent,
  };

  const logoUrl =
    typeof x.logoUrl === "string" || x.logoUrl === null ? x.logoUrl : base.logoUrl;

  const titleLines = Array.isArray(x.titleLines)
    ? x.titleLines.map(String).slice(0, 6)
    : base.titleLines;

  const titleColor = isHex(x.titleColor) ? x.titleColor : base.titleColor;

  const notices = Array.isArray(x.notices)
    ? x.notices.slice(0, 20).map((n: any, i: number) => ({
        id: String(n?.id ?? i),
        title: String(n?.title ?? ""),
        icon: n?.icon ? String(n.icon) : undefined,
        lines: Array.isArray(n?.lines) ? n.lines.map(String).slice(0, 20) : [],
      }))
    : base.notices;

  const bgType = oneOf(x?.background?.type, ["solid", "gradient"]) ?? base.background.type;
  const background =
    bgType === "gradient"
      ? {
          type: "gradient" as const,
          color1: isHex(x?.background?.color1) ? x.background.color1 : base.background.color1,
          color2: isHex(x?.background?.color2) ? x.background.color2 : "#FFFFFF",
          direction:
            oneOf(x?.background?.direction, ["to-b", "to-r", "to-tr", "to-br"]) ?? "to-b",
        }
      : {
          type: "solid" as const,
          color1: isHex(x?.background?.color1) ? x.background.color1 : base.background.color1,
        };

  return { themePreset, colors, logoUrl, titleLines, titleColor, notices, background };
}

/* ───────── tabs/presets ───────── */
type Tab = "theme" | "logo" | "notice" | "background";
const PRESETS: Record<
  NonNullable<PatientPageConfig["themePreset"]>,
  { bg: string; fg: string; accent: string }
> = {
  modern: { bg: "#EEF4FF", fg: "#0F172A", accent: "#3B82F6" },
  warm: { bg: "#FEF3C7", fg: "#3F2B1E", accent: "#F59E0B" },
  trust: { bg: "#ECFDF5", fg: "#064E3B", accent: "#10B981" },
  classic: { bg: "#F3F4F6", fg: "#111827", accent: "#2563EB" },
};

export default function PatientPageCustomizer() {
  const [tab, setTab] = useState<Tab>("theme");
  const [cfg, setCfg] = useState<PatientPageConfig>(DEFAULT_CFG);
  const [saving, setSaving] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const loadedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* load */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/org/patient-page", { cache: "no-store" });
        const j = await r.json();
        setCfg(normalize(j?.config));
      } catch {
        setCfg(DEFAULT_CFG);
      } finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  /* helpers using normalized snapshot */
  const colors = cfg.colors ?? DEFAULT_CFG.colors;

  function applyPreset(p: NonNullable<PatientPageConfig["themePreset"]>) {
    const c = PRESETS[p];
    setCfg((s) => normalize({ ...s, themePreset: p, colors: { ...c } }));
  }
  function setColor(key: "bg" | "fg" | "accent", v: string) {
    setCfg((s) => normalize({ ...s, colors: { ...(s.colors ?? {}), [key]: v } }));
  }

  function addTitleLine() {
    setCfg((s) => normalize({ ...s, titleLines: [...(s.titleLines ?? []), ""] }));
  }
  function updateTitleLine(i: number, v: string) {
    setCfg((s) =>
      normalize({
        ...s,
        titleLines: (s.titleLines ?? []).map((x, idx) => (idx === i ? v : x)),
      }),
    );
  }
  function removeTitleLine(i: number) {
    setCfg((s) =>
      normalize({
        ...s,
        titleLines: (s.titleLines ?? []).filter((_, idx) => idx !== i),
      }),
    );
  }

  function addNotice() {
    setCfg((s) =>
      normalize({
        ...s,
        notices: [...(s.notices ?? []), { id: String(Date.now()), title: "", lines: [] }],
      }),
    );
  }
  function updateNotice(i: number, patch: Partial<PatientPageConfig["notices"][number]>) {
    setCfg((s) =>
      normalize({
        ...s,
        notices: (s.notices ?? []).map((n, idx) => (idx === i ? { ...n, ...patch } : n)),
      }),
    );
  }
  function updateNoticeLine(i: number, j: number, v: string) {
    setCfg((s) => {
      const ns = [...(s.notices ?? [])];
      const lines = [...(ns[i]?.lines ?? [])];
      lines[j] = v;
      ns[i] = { ...(ns[i] || { id: String(i), title: "" }), lines };
      return normalize({ ...s, notices: ns });
    });
  }
  function addNoticeLine(i: number) {
    setCfg((s) => {
      const ns = [...(s.notices ?? [])];
      const lines = [...(ns[i]?.lines ?? []), ""];
      ns[i] = { ...(ns[i] || { id: String(i), title: "" }), lines };
      return normalize({ ...s, notices: ns });
    });
  }
  function removeNotice(i: number) {
    setCfg((s) => normalize({ ...s, notices: (s.notices ?? []).filter((_, idx) => idx !== i) }));
  }
  function removeNoticeLine(i: number, j: number) {
    setCfg((s) => {
      const ns = [...(s.notices ?? [])];
      const lines = (ns[i]?.lines ?? []).filter((_, idx) => idx !== j);
      ns[i] = { ...(ns[i] || { id: String(i), title: "" }), lines };
      return normalize({ ...s, notices: ns });
    });
  }

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/i.test(f.type)) {
      alert("jpg 또는 png만 가능합니다.");
      e.target.value = "";
      return;
    }
    if (f.size > 200 * 1024) {
      alert("파일은 200KB 이하만 허용합니다.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setCfg((s) => normalize({ ...s, logoUrl: String(reader.result || "") }));
    reader.readAsDataURL(f);
  }
  function clearLogo() {
    setCfg((s) => normalize({ ...s, logoUrl: null }));
  }

  async function save() {
    setSaving("saving");
    try {
      const r = await fetch("/api/org/patient-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg }),
      });
      if (!r.ok) throw new Error();
      setSaving("ok");
      setTimeout(() => setSaving("idle"), 1000);
    } catch {
      setSaving("err");
      setTimeout(() => setSaving("idle"), 1200);
    }
  }

  /* autosave(debounce) */
  useEffect(() => {
    if (!loadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  function setBgType(t: "solid" | "gradient") {
    setCfg((s) => normalize({ ...s, background: { ...(s.background || {}), type: t } }));
  }
  function setBgField<K extends "color1" | "color2" | "direction">(k: K, v: string) {
    setCfg((s) => normalize({ ...s, background: { ...(s.background || {}), [k]: v } }));
  }

  /* preview bg */
  const previewStyle = useMemo<React.CSSProperties>(() => {
    const bg =
      cfg.background?.type === "gradient" && cfg.background?.color2
        ? {
            backgroundImage: `linear-gradient(${
              cfg.background.direction === "to-r"
                ? "to right"
                : cfg.background.direction === "to-tr"
                ? "to top right"
                : cfg.background.direction === "to-br"
                ? "to bottom right"
                : "to bottom"
            }, ${cfg.background.color1}, ${cfg.background.color2})`,
          }
        : { background: cfg.background?.color1 || DEFAULT_CFG.background.color1 };
    return bg;
  }, [cfg.background]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 좌측: 탭 폼 */}
      <div className="space-y-5">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
          {(
            [
              ["theme", "테마"],
              ["logo", "로고/제목"],
              ["notice", "공지사항"],
              ["background", "배경"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                "px-3 py-1.5 text-sm rounded-lg " +
                (tab === k ? "bg-blue-600 text-white" : "hover:bg-gray-50")
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {/* 테마 */}
        {tab === "theme" && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700">간편 테마 선택</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => {
                const p = PRESETS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyPreset(k as any)}
                    className="rounded-lg border border-gray-200 p-2 text-sm hover:shadow"
                    title={k}
                  >
                    <div className="h-8 w-full rounded" style={{ background: p.bg }} />
                    <div className="mt-1 text-[11px]">{k}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ColorEditor label="배경(bg)" value={colors.bg} onChange={(v) => setColor("bg", v)} />
              <ColorEditor label="글자(fg)" value={colors.fg} onChange={(v) => setColor("fg", v)} />
              <ColorEditor label="포인트(accent)" value={colors.accent} onChange={(v) => setColor("accent", v)} />
            </div>
          </div>
        )}

        {/* 로고/제목 */}
        {tab === "logo" && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700">로고 업로드</div>
            <div className="flex items-center gap-3">
              <input type="file" accept="image/png,image/jpeg" onChange={onLogoFile} />
              {cfg.logoUrl ? (
                <button type="button" onClick={clearLogo} className="btn btn-ghost">
                  로고 삭제
                </button>
              ) : null}
            </div>
            {cfg.logoUrl ? (
              <div className="rounded-lg border p-3">
                <img src={cfg.logoUrl} alt="logo preview" style={{ maxWidth: 200, height: "auto" }} />
                <div className="text-xs text-gray-500 mt-1">미리보기</div>
              </div>
            ) : (
              <>
                <div className="text-sm font-semibold text-gray-700">텍스트 제목</div>
                <div className="space-y-2">
                  {(cfg.titleLines ?? []).map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input grow"
                        value={t}
                        onChange={(e) => updateTitleLine(i, e.target.value)}
                        placeholder={`제목 줄 ${i + 1}`}
                      />
                      <button className="btn btn-ghost" type="button" onClick={() => removeTitleLine(i)}>
                        삭제
                      </button>
                    </div>
                  ))}
                  <button className="btn" type="button" onClick={addTitleLine}>
                    줄 추가
                  </button>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">글씨 색</div>
                  <input
                    type="color"
                    value={cfg.titleColor ?? DEFAULT_CFG.titleColor}
                    onChange={(e) =>
                      setCfg((s) => normalize({ ...s, titleColor: e.target.value || DEFAULT_CFG.titleColor }))
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* 공지사항 */}
        {tab === "notice" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">공지 목록</div>
              <button className="btn" type="button" onClick={addNotice}>
                공지 아이템 추가
              </button>
            </div>

            {(cfg.notices ?? []).map((n, i) => (
              <div key={n.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input grow"
                    placeholder="제목"
                    value={n.title}
                    onChange={(e) => updateNotice(i, { title: e.target.value })}
                  />
                  <input
                    className="input w-28"
                    placeholder="아이콘"
                    value={n.icon ?? ""}
                    onChange={(e) => updateNotice(i, { icon: e.target.value || undefined })}
                  />
                  <button className="btn btn-ghost" type="button" onClick={() => removeNotice(i)}>
                    삭제
                  </button>
                </div>
                <div className="space-y-2">
                  {(n.lines ?? []).map((v, j) => (
                    <div key={j} className="flex gap-2">
                      <input
                        className="input grow"
                        placeholder={`내용 ${j + 1}`}
                        value={v}
                        onChange={(e) => updateNoticeLine(i, j, e.target.value)}
                      />
                      <button className="btn btn-ghost" type="button" onClick={() => removeNoticeLine(i, j)}>
                        삭제
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" type="button" onClick={() => addNoticeLine(i)}>
                    줄 추가
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 배경 */}
        {tab === "background" && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700">배경 유형</div>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={cfg.background?.type === "solid"} onChange={() => setBgType("solid")} />
                단색
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={cfg.background?.type === "gradient"} onChange={() => setBgType("gradient")} />
                그라데이션
              </label>
            </div>

            {cfg.background?.type === "solid" && (
              <div>
                <div className="text-xs text-gray-600 mb-1">색상</div>
                <input type="color" value={cfg.background.color1} onChange={(e) => setBgField("color1", e.target.value)} />
              </div>
            )}

            {cfg.background?.type === "gradient" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">시작 색상</div>
                  <input type="color" value={cfg.background.color1} onChange={(e) => setBgField("color1", e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">끝 색상</div>
                  <input
                    type="color"
                    value={cfg.background.color2 || "#FFFFFF"}
                    onChange={(e) => setBgField("color2", e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">방향</div>
                  <select
                    className="input"
                    value={cfg.background.direction || "to-b"}
                    onChange={(e) => setBgField("direction", e.target.value)}
                  >
                    <option value="to-b">top → bottom</option>
                    <option value="to-r">left → right</option>
                    <option value="to-tr">left → top-right</option>
                    <option value="to-br">left → bottom-right</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 수동 저장 버튼(자동 저장도 동작) */}
        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={save}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            disabled={saving === "saving"}
            type="button"
          >
            {saving === "saving" ? "저장 중..." : "저장"}
          </button>
          {saving === "ok" && <span className="text-green-600 text-sm">저장됨</span>}
          {saving === "err" && <span className="text-red-600 text-sm">실패</span>}
          <span className="text-xs text-gray-500">입력 변경 시 자동 저장됩니다.</span>
        </div>
      </div>

      {/* 우측: 모바일 미리보기(휴대폰 목업 + 샘플 콘텐츠 고정) */}
      <div>
        <div className="mb-2 text-sm font-semibold text-gray-700">모바일 미리보기</div>

        {/* Phone mockup frame */}
        <div className="mx-auto w-[390px]">
          <div className="relative rounded-[42px] bg-neutral-900 p-2 shadow-2xl ring-1 ring-black/30">
            {/* top notch */}
            <div className="absolute left-1/2 top-1 z-10 h-6 w-32 -translate-x-1/2 rounded-b-[18px] bg-black/70" />
            {/* screen */}
            <div className="rounded-[36px] overflow-hidden bg-white" style={{ height: 780 }}>
              {/* status bar spacer */}
              <div className="h-5 bg-black/5" />
              {/* screen body */}
              <div className="min-h-full p-4" style={previewStyle}>
                {/* 헤더: 로고/제목 */}
                <div className="text-center mb-3">
                  {cfg.logoUrl ? (
                    <img
                      src={cfg.logoUrl}
                      alt="logo"
                      style={{ maxWidth: 220, height: "auto", display: "inline-block" }}
                    />
                  ) : (
                    <div style={{ color: cfg.titleColor || DEFAULT_CFG.titleColor }}>
                      {(cfg.titleLines ?? []).map((t, i) => (
                        <div
                          key={i}
                          style={{ fontWeight: 800, fontSize: i === 0 ? 22 : 15, lineHeight: 1.2 }}
                        >
                          {t || "\u00A0"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 공지 섹션 라벨 */}
                <div className="px-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                    <span className="inline-flex h-2 w-2 rounded-full bg-pink-500" />
                    공지
                  </div>
                </div>

                {/* 공지 카드 래퍼 */}
                <div
                  className="mt-2 rounded-2xl border border-black/5 p-3"
                  style={{ background: colors.bg, color: colors.fg }}
                >
                  {(cfg.notices ?? []).length ? (
                    (cfg.notices ?? []).map((n) => (
                      <div
                        key={n.id}
                        className="my-2 rounded-xl"
                        style={{
                          padding: "10px 12px",
                          background: `${colors.accent}20`,
                          borderLeft: `6px solid ${colors.accent}`,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: colors.accent, marginBottom: 4 }}>
                          {(n.icon ? `${n.icon} ` : "") + (n.title || "")}
                        </div>
                        <ul className="list-disc pl-5 leading-6">
                          {(n.lines ?? []).map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <div className="opacity-70">등록된 공지사항이 없습니다.</div>
                  )}
                </div>

                {/* 샘플 탭(고정) */}
                <div className="mt-5 px-1">
                  <div className="rounded-full bg-slate-100 p-1 flex items-center gap-1">
                    {["종합검진", "공단검진", "기업/단체"].map((t, idx) => (
                      <div
                        key={t}
                        className={
                          "flex-1 text-center text-[13px] py-2 rounded-full " +
                          (idx === 0 ? "bg-white text-blue-600 shadow" : "text-gray-600")
                        }
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 샘플 패키지 3개(고정) */}
                <div className="mt-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-[15px] font-semibold text-slate-800">00만 테스트 </div>
                        <div className="text-[13px] text-slate-600">
                          <span className="font-semibold text-slate-800">000,000</span>원
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[12px] text-slate-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="5" width="18" height="16" rx="2" stroke="#64748B" strokeWidth="1.6" />
                          <path d="M8 3v4M16 3v4M3 9h18" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        2025-01-01 ~ 2025-12-31
                      </div>
                      <div className="mt-2">
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-slate-50 cursor-default"
                        >
                          자세히 보기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* bottom home indicator */}
              <div className="flex justify-center py-2">
                <div className="h-1.5 w-24 rounded-full bg-black/20" />
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          상단 영역(배경·제목·공지)만 편집·저장됩니다. 하단 탭/패키지는 샘플입니다.
        </p>
      </div>
    </div>
  );
}

/* ───────── 소형 컴포넌트 ───────── */
function ColorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded border border-gray-300"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border rounded px-2 py-1 text-sm"
      />
    </div>
  );
}



