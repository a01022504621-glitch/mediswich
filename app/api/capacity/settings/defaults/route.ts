export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/capacity/settings/defaults/route.ts
import { NextResponse } from "next/server";

type Settings = {
  specials: string[]; // 특정검사 명칭 목록(표시용)
  defaults: { BASIC: number; NHIS: number; SPECIAL: number }; // 기본 케파
  examDefaults: Record<string, number>; // examId -> 기본 케파
};

function ensureSettings(): Settings {
  const g = globalThis as any;
  if (!g.__capacitySettings) {
    g.__capacitySettings = {
      specials: ["위내시경(수면)", "대장내시경(수면)", "위내시경(비수면)"],
      defaults: { BASIC: 40, NHIS: 20, SPECIAL: 12 },
      examDefaults: { egd_sed: 6, colon_sed: 6, egd_awake: 6 },
    } as Settings;
  }
  return g.__capacitySettings as Settings;
}

export async function GET() {
  const S = ensureSettings();
  return NextResponse.json(S);
}

export async function PUT(req: Request) {
  const S = ensureSettings();
  const body = await req.json().catch(() => ({}));

  if (body?.defaults) {
    const BASIC = Number(body.defaults.BASIC);
    const NHIS = Number(body.defaults.NHIS);
    const SPECIAL = Number(body.defaults.SPECIAL);
    if ([BASIC, NHIS, SPECIAL].every((n) => Number.isFinite(n) && n >= 0)) {
      S.defaults = { BASIC, NHIS, SPECIAL };
    }
  }

  if (Array.isArray(body?.specials)) {
    S.specials = body.specials.map((x: any) => String(x)).filter(Boolean);
  }

  if (body?.examDefaults && typeof body.examDefaults === "object") {
    S.examDefaults = Object.fromEntries(
      Object.entries(body.examDefaults).map(([k, v]) => [String(k), Number(v)])
    );
  }

  return NextResponse.json(S);
}

