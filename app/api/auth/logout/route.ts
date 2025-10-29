export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, cookieDomain } from "@/lib/auth/jwt"; // 'msw_m'

const EXP_COOKIE = "msw_exp";

// Expire with minimal set by default; for critical session cookies, widen scope
function expire(res: NextResponse, name: string, opts: { httpOnly?: boolean }) {
  const prod = process.env.NODE_ENV === "production";
  const domain = cookieDomain();
  res.cookies.set(name, "", {
    httpOnly: !!opts.httpOnly,
    sameSite: "lax",
    secure: prod,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    ...(domain ? { domain } : {}),
  });
  // Best-effort host-only variant
  res.cookies.set(name, "", {
    httpOnly: !!opts.httpOnly,
    sameSite: "lax",
    secure: prod,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

function expireWide(res: NextResponse, name: string, opts: { httpOnly?: boolean }, host?: string) {
  const prod = process.env.NODE_ENV === "production";
  const base = cookieDomain();
  const hosts = Array.from(new Set([base, undefined, host].filter(Boolean))) as string[] | (undefined[]);
  const paths = ["/", "/m"]; // keep small but cover common
  for (const d of hosts as (string | undefined)[]) {
    for (const p of paths) {
      res.cookies.set(name, "", {
        httpOnly: !!opts.httpOnly,
        sameSite: "lax",
        secure: prod,
        path: p,
        maxAge: 0,
        expires: new Date(0),
        ...(d ? { domain: d } : {}),
      });
    }
  }
}

function expireAll(res: NextResponse, name: string, opts: { httpOnly?: boolean }) {
  const prod = process.env.NODE_ENV === "production";
  // 모든 가능성 커버: 미지정, 최상위 도메인, 서브도메인
  const domains: (string | undefined)[] = [undefined, ".mediswich.co.kr", "admin.mediswich.co.kr"];
  const paths = ["/", "/m", "/m/"];

  for (const d of domains) {
    for (const p of paths) {
      res.cookies.set(name, "", {
        httpOnly: !!opts.httpOnly,
        sameSite: "lax",
        secure: prod,
        path: p,
        maxAge: 0,
        expires: new Date(0),
        ...(d ? { domain: d } : {}),
      });
    }
  }
  // best-effort
  res.cookies.delete(name);
}

function clearAll(res: NextResponse, host?: string) {
  // Critical session cookies: clear across likely variants
  expireWide(res, COOKIE_NAME, { httpOnly: true }, host);
  expireWide(res, EXP_COOKIE, { httpOnly: false }, host);
  // Secondary cookies: minimal clear
  expire(res, "current_hospital_id", { httpOnly: true });
  expire(res, "current_hospital_slug", { httpOnly: true });
  expire(res, "csrf", { httpOnly: false });
  expire(res, "msw_csrf", { httpOnly: false });

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function GET(req: NextRequest) {
  const to = new URL(req.nextUrl);
  to.pathname = "/m/login";
  to.search = "";
  const res = NextResponse.redirect(to);
  return clearAll(res, req.headers.get("host") || undefined);
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  return clearAll(res);
}
