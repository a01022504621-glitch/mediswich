// lib/patient-page/render.ts
export type PatientPageConfig = {
  themePreset?: "modern" | "warm" | "trust" | "classic";
  colors: { bg: string; fg: string; accent: string };
  logoUrl?: string | null;
  titleLines?: string[];
  titleColor?: string;
  notices: { id: string; title: string; icon?: string; lines: string[] }[];
  background: {
    type: "solid" | "gradient";
    color1: string;
    color2?: string;
    direction?: "to-b" | "to-r" | "to-tr" | "to-br";
  };
};

export function defaultConfig(): PatientPageConfig {
  return {
    themePreset: "modern",
    colors: { bg: "#EEF4FF", fg: "#0F172A", accent: "#3B82F6" },
    logoUrl: null,
    titleLines: ["Health Checkup Center"],
    titleColor: "#0F172A",
    notices: [],
    background: { type: "solid", color1: "#F9FAFB" },
  };
}

export function sanitizeHtml(html: string) {
  return String(html ?? "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

/** 공지 리스트를 단일 블록 HTML로 렌더링 */
export function renderNoticeHtml(cfg: PatientPageConfig): string {
  const c = cfg.colors || { bg: "#EEF4FF", fg: "#0F172A", accent: "#3B82F6" };
  const items = cfg.notices || [];

  const blocks = items
    .map((it) => {
      const icon = it.icon ? `<span style="margin-right:6px">${escapeHtml(it.icon)}</span>` : "";
      const title = it.title ? `<div style="font-weight:800;color:${c.accent};margin-bottom:6px">${escapeHtml(it.title)}</div>` : "";
      const lines =
        it.lines && it.lines.length
          ? `<ul style="margin:0;padding-left:18px;line-height:1.6">${it.lines
              .map((x) => `<li>${escapeHtml(x)}</li>`)
              .join("")}</ul>`
          : "";
      return `<div style="padding:12px 14px;border-radius:12px;background:${c.accent}14;border-left:6px solid ${c.accent};margin:10px 0">
        <div style="display:flex;align-items:center;font-size:13px">${icon}${title}</div>
        <div>${lines}</div>
      </div>`;
    })
    .join("");

  const html = `
<div style="border-radius:16px;padding:18px;background:${c.bg};color:${c.fg};border:1px solid rgba(0,0,0,.06)">
  ${blocks || `<div style="opacity:.7">등록된 공지사항이 없습니다.</div>`}
</div>`.trim();

  return sanitizeHtml(html);
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


