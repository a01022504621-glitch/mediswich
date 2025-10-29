export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, cookieDomain } from "@/lib/auth/jwt"; // 'msw_m'

const EXP_COOKIE = "msw_exp";

// Serialize cookie string manually so we can append multiple Set-Cookie lines
function serializeExpireCookie(name: string, opts: { path: string; domain?: string; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" }) {
  const parts = [`${encodeURIComponent(name)}=`];
  parts.push(`Path=${opts.path}`);
  parts.push(`Expires=${new Date(0).toUTCString()}`);
  parts.push(`Max-Age=0`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure) parts.push(`Secure`);
  if (opts.httpOnly) parts.push(`HttpOnly`);
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite.charAt(0).toUpperCase()}${opts.sameSite.slice(1)}`);
  return parts.join("; ");
}

function appendExpire(res: NextResponse, name: string, opts: { httpOnly?: boolean }, host?: string) {
  const prod = process.env.NODE_ENV === "production";
  const base = cookieDomain();
  const domains: (string | undefined)[] = [];
  if (base) domains.push(base);
  if (host) domains.push(host);
  domains.push(undefined); // host-only
  const paths = ["/", "/m"]; // cover common
  for (const d of domains) {
    for (const p of paths) {
      const line = serializeExpireCookie(name, {
        path: p,
        domain: d,
        httpOnly: !!opts.httpOnly,
        secure: prod,
        sameSite: "lax",
      });
      res.headers.append("set-cookie", line);
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
  // Critical session cookies: append multiple Set-Cookie lines for different domain/path
  appendExpire(res, COOKIE_NAME, { httpOnly: true }, host);
  appendExpire(res, EXP_COOKIE, { httpOnly: false }, host);
  // Secondary cookies: also append (domain base + host-only) for Path=/ and /m
  appendExpire(res, "current_hospital_id", { httpOnly: true }, host);
  appendExpire(res, "current_hospital_slug", { httpOnly: true }, host);
  appendExpire(res, "csrf", { httpOnly: false }, host);
  appendExpire(res, "msw_csrf", { httpOnly: false }, host);

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
