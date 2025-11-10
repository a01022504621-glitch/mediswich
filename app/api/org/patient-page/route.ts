export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// app/api/org/patient-page/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/session";
import {
  defaultConfig,
  renderNoticeHtml,
  sanitizeHtml,
  type PatientPageConfig,
} from "@/lib/patient-page/render";

async function getHid() {
  const s = await requireSession();
  const hid = (s as any)?.hid ?? (s as any)?.hospitalId;
  if (!hid) throw new Error("No hospital in session");
  return String(hid);
}

export async function GET() {
  try {
    const hid = await getHid();
    const hospital = await prisma.hospital.findUnique({
      where: { id: hid },
      select: { themeJson: true, logoUrl: true, noticeHtml: true, name: true, slug: true },
    });

    const cfg: PatientPageConfig =
      hospital?.themeJson ? safeParse(hospital.themeJson) ?? defaultConfig() : defaultConfig();

    return NextResponse.json({
      ok: true,
      config: cfg,
      logoUrl: hospital?.logoUrl ?? null,
      noticeHtml: hospital?.noticeHtml ?? "",
      meta: { name: hospital?.name, slug: hospital?.slug },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const hid = await getHid();
    const body = await req.json().catch(() => ({}));
    const cfg = validateConfig(body?.config) ?? defaultConfig();

    // noticeHtml 생성
    const noticeHtml = renderNoticeHtml(cfg);

    await prisma.hospital.update({
      where: { id: hid },
      data: {
        themeJson: JSON.stringify(cfg),
        logoUrl: cfg.logoUrl ?? null,
        noticeHtml: sanitizeHtml(noticeHtml),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

/* ───────── helpers ───────── */
function safeParse(s?: string) {
  try {
    return s ? (JSON.parse(s) as PatientPageConfig) : null;
  } catch {
    return null;
  }
}

function isHex(x?: string) {
  return typeof x === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(x);
}

function validateConfig(x: any): PatientPageConfig | null {
  if (!x || typeof x !== "object") return null;
  const out: PatientPageConfig = {
    themePreset: oneOf(x.themePreset, ["modern", "warm", "trust", "classic"]) ?? "modern",
    colors: {
      bg: isHex(x?.colors?.bg) ? x.colors.bg : "#EEF4FF",
      fg: isHex(x?.colors?.fg) ? x.colors.fg : "#0F172A",
      accent: isHex(x?.colors?.accent) ? x.colors.accent : "#3B82F6",
    },
    logoUrl: typeof x.logoUrl === "string" || x.logoUrl === null ? x.logoUrl : null,
    titleLines: Array.isArray(x.titleLines) ? x.titleLines.map(String).slice(0, 6) : ["Health Checkup Center"],
    titleColor: isHex(x.titleColor) ? x.titleColor : "#0F172A",
    notices: Array.isArray(x.notices)
      ? x.notices
          .slice(0, 20)
          .map((n: any, i: number) => ({
            id: String(n?.id ?? i),
            title: String(n?.title ?? ""),
            icon: n?.icon ? String(n.icon) : undefined,
            lines: Array.isArray(n?.lines) ? n.lines.map(String).slice(0, 20) : [],
          }))
      : [],
    background: {
      type: oneOf(x?.background?.type, ["solid", "gradient"]) ?? "solid",
      color1: isHex(x?.background?.color1) ? x.background.color1 : "#F9FAFB",
      color2: isHex(x?.background?.color2) ? x.background.color2 : undefined,
      direction: oneOf(x?.background?.direction, ["to-b", "to-r", "to-tr", "to-br"]) ?? "to-b",
    },
  };
  return out;
}

function oneOf<T extends string>(v: any, arr: readonly T[]): T | undefined {
  return arr.includes(v) ? (v as T) : undefined;
}



