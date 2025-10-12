// app/api/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSession, sessionCookie, expCookie, SESSION_TTL_SEC } from "@/lib/auth/jwt";
import { timingSafeEqual } from "crypto";

/* ── 간단 레이트리밋(IP당 10분 20회) ── */
const glb = globalThis as unknown as { __loginRL?: Map<string, number[]> };
glb.__loginRL ??= new Map();
const WINDOW = 10 * 60 * 1000;
const MAX_REQ = 20;
function passRateLimit(ip: string) {
  const now = Date.now();
  const arr = (glb.__loginRL!.get(ip) || []).filter((t) => now - t < WINDOW);
  if (arr.length >= MAX_REQ) return false;
  arr.push(now);
  glb.__loginRL!.set(ip, arr);
  return true;
}

/* ── CSRF(Double Submit) ── */
function parseCookies(h: string | null) {
  const m: Record<string, string> = {};
  if (!h) return m;
  h.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) m[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return m;
}
function safeEq(a: string, b: string) {
  try {
    const A = Buffer.from(a);
    const B = Buffer.from(b);
    if (A.length !== B.length) return false;
    return timingSafeEqual(A, B);
  } catch {
    return false;
  }
}
function getClientIp(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (!xf) return "0.0.0.0";
  return xf.split(",")[0].trim();
}

const CSRF_OFF = process.env.AUTH_CSRF_DISABLED === "1" || process.env.NODE_ENV !== "production";

export async function POST(req: NextRequest) {
  try {
    // 1) 레이트리밋
    const ip = getClientIp(req);
    if (!passRateLimit(ip)) {
      return NextResponse.json({ ok: false, message: "RATE_LIMITED" }, { status: 429 });
    }

    // 2) CSRF 검사(개발/비프로덕션 또는 AUTH_CSRF_DISABLED=1이면 생략)
    if (!CSRF_OFF) {
      const cookies = parseCookies(req.headers.get("cookie"));
      const headerToken = req.headers.get("x-csrf-token") || req.headers.get("x-xsrf-token") || "";
      const cookieToken =
        cookies["msw_csrf"] || cookies["csrf"] || cookies["X-CSRF-Token"] || cookies["x-csrf-token"] || "";
      if (!headerToken || !cookieToken || !safeEq(String(headerToken), String(cookieToken))) {
        return NextResponse.json({ ok: false, message: "CSRF_FAIL" }, { status: 403 });
      }
    }

    // 3) 입력 파싱
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const tenantRaw = body.tenant;

    if (!emailRaw || !password) {
      return NextResponse.json({ ok: false, message: "INVALID_INPUT" }, { status: 400 });
    }

    const email = emailRaw.trim().toLowerCase();
    const tenant = typeof tenantRaw === "string" ? tenantRaw.trim().toLowerCase() : undefined;

    // 4) 병원 결정
    const hospital =
      (tenant ? await prisma.hospital.findFirst({ where: { slug: tenant } }) : null) ||
      (await prisma.hospital.findFirst({ orderBy: { id: "asc" } }));
    if (!hospital) {
      return NextResponse.json({ ok: false, message: "NO_HOSPITAL" }, { status: 400 });
    }

    // 5) 사용자 조회
    const user = await prisma.user.findFirst({
      where: { hospitalId: hospital.id, email },
    });
    if (!user) {
      return NextResponse.json({ ok: false, message: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    // 6) 비밀번호 검증
    const passOk = await bcrypt.compare(password, user.password);
    if (!passOk) {
      return NextResponse.json({ ok: false, message: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    // 7) 세션 발급 (hospitalId가 null이면 키 생략)
    const payload: {
      sub: string;
      role: typeof user.role;
      hospitalSlug: string;
      hospitalId?: string;
    } = {
      sub: user.id,
      role: user.role,
      hospitalSlug: hospital.slug ?? String(hospital.id),
    };
    if (user.hospitalId) payload.hospitalId = user.hospitalId;

    const token = await signSession(payload);

    const res = NextResponse.json({ ok: true });

    const sc = sessionCookie(token, SESSION_TTL_SEC);
    res.cookies.set(sc.name, sc.value, sc.options);

    const expUnix = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
    const ec = expCookie(expUnix);
    res.cookies.set(ec.name, ec.value, ec.options);

    return res;
  } catch (e) {
    console.error("[/api/auth/login] error:", e);
    return NextResponse.json({ ok: false, message: "SERVER_ERROR" }, { status: 500 });
  }
}



