// app/(r-public)/r/[tenant]/page.tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";
import CatalogClient from "./_components/CatalogClient.client";
import type { CSSProperties } from "react";

export const revalidate = 120;

/* --- 타입 및 기본값 --- */
type PatientPageConfig = {
  themePreset?: "modern" | "warm" | "trust" | "classic";
  colors?: { bg?: string; fg?: string; accent?: string };
  logoUrl?: string | null;
  titleLines?: string[];
  titleColor?: string;
  background?: {
    type?: "solid" | "gradient";
    color1?: string;
    color2?: string;
    direction?: "to-b" | "to-r" | "to-tr" | "to-br";
  };
};

// [수정 1] : Required<PatientPageConfig> 타입 선언 제거
const DEFAULT_CFG = {
  themePreset: "modern",
  colors: { bg: "#EEF4FF", fg: "#0F172A", accent: "#3B82F6" },
  logoUrl: null,
  titleLines: ["Health Checkup Center"],
  titleColor: "#0F172A",
  background: { type: "solid", color1: "#F9FAFB", color2: "#FFFFFF", direction: "to-b" },
};

/* 유효 hex 색상인지 판별하는 타입가드 */
const RE_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function isHex(x: unknown): x is string {
  return typeof x === "string" && RE_HEX.test(x);
}

function safeParse(s: string | null | undefined) {
  try {
    return s ? (JSON.parse(s) as PatientPageConfig) : undefined;
  } catch {
    return undefined;
  }
}

// [수정 2] : Required<PatientPageConfig> 반환 타입 선언 제거
function norm(cfg?: PatientPageConfig) {
  const c = cfg || {};
  return {
    themePreset: (["modern", "warm", "trust", "classic"] as const).includes(c.themePreset as any)
      ? (c.themePreset as any)
      : DEFAULT_CFG.themePreset,
    colors: {
      bg: isHex(c.colors?.bg) ? c.colors.bg : DEFAULT_CFG.colors.bg,
      fg: isHex(c.colors?.fg) ? c.colors.fg : DEFAULT_CFG.colors.fg,
      accent: isHex(c.colors?.accent) ? c.colors.accent : DEFAULT_CFG.colors.accent,
    },
    logoUrl: typeof c.logoUrl === "string" || c.logoUrl === null ? c.logoUrl : null,
    titleLines:
      Array.isArray(c.titleLines) && c.titleLines.length
        ? c.titleLines.map(String).slice(0, 6)
        : DEFAULT_CFG.titleLines,
    titleColor: isHex(c.titleColor) ? c.titleColor : DEFAULT_CFG.titleColor,
    background: {
      type:
        c.background?.type === "gradient" || c.background?.type === "solid"
          ? c.background.type
          : DEFAULT_CFG.background.type,
      color1: isHex(c.background?.color1) ? c.background.color1 : DEFAULT_CFG.background.color1,
      color2: isHex(c.background?.color2) ? c.background.color2 : DEFAULT_CFG.background.color2,
      direction:
        (["to-b", "to-r", "to-tr", "to-br"] as const).includes(c.background?.direction as any)
          ? (c.background?.direction as any)
          : DEFAULT_CFG.background.direction,
    },
  };
}

function sanitize(html?: string) {
  return String(html ?? "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export default async function RLanding({ params }: { params: { tenant: string } }) {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";

  const t = await resolveTenantHybrid({ slug: params.tenant, host });
  if (!t) notFound();

  const hospital = await prisma.hospital.findUnique({
    where: { id: t.id },
    select: { slug: true, name: true, noticeHtml: true, themeJson: true, logoUrl: true },
  });
  if (!hospital) notFound();

  const cfg = norm(safeParse(hospital.themeJson));
  const notice = sanitize(hospital.noticeHtml ?? undefined);

  const bgStyle: CSSProperties =
    cfg.background.type === "gradient" && cfg.background.color2
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
      : { background: cfg.background.color1 };

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={bgStyle}>
      {/* 액센트 글로우 (이제 cfg.colors.accent는 항상 string이므로 안전합니다) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-56 -left-56 h-[720px] w-[720px] rounded-full blur-[120px] opacity-20"
          style={{ background: `${cfg.colors.accent}44` }}
        />
      </div>

      <div className="mx-auto w-full max-w-xl p-3 sm:p-5">
        {/* 헤더 + 공지 */}
        <section className="rounded-2xl bg-white/90 backdrop-blur-md shadow-xl ring-1 ring-slate-100/70">
          {/* 헤더 */}
          <div className="rounded-t-2xl bg-white/90 px-4 py-5 backdrop-blur-md">
            <div className="text-center">
              <div
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: cfg.colors.accent }}
              >
                {hospital.name} 검진 예약
              </div>

              {cfg.logoUrl ? (
                <img
                  src={cfg.logoUrl}
                  alt="logo"
                  className="mx-auto mt-1"
                  style={{ maxWidth: 200, height: "auto" }}
                />
              ) : (
                <div className="mt-1">
                  {(cfg.titleLines ?? []).map((line, i) => (
                    <div
                      key={i}
                      className={i === 0 ? "text-2xl font-extrabold" : "text-base font-semibold"}
                      style={{ color: cfg.titleColor }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 공지 */}
          {notice ? (
            <div className="px-4 pb-5 pt-0">
              <div className="rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: cfg.colors.accent }}>
                    📢 공지
                  </span>
                  <div className="h-px grow" style={{ background: `${cfg.colors.accent}33` }} />
                </div>
                <div
                  className="mt-2 max-h-[220px] overflow-auto pr-1 text-sm leading-snug"
                  style={{ color: cfg.colors.fg }}
                  dangerouslySetInnerHTML={{ __html: notice }}
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* 카탈로그 */}
        <section className="mt-3">
          <CatalogClient slug={hospital.slug} hospitalName={hospital.name} />
        </section>
      </div>
    </main>
  );
}


