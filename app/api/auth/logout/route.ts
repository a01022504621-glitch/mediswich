// app/api/auth/logout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/jwt";

function baseDomain(hostname: string) {
  const h = hostname.toLowerCase();
  const parts = h.split(".");
  const isKr2nd = [".co.kr", ".or.kr", ".go.kr", ".ne.kr", ".re.kr"].some((s) => h.endsWith(s));
  return parts.slice(isKr2nd ? -3 : -2).join(".");
}

function expire(
  res: NextResponse,
  name: string,
  doms: (string | undefined)[],
  isProd: boolean,
  httpOnly: boolean
) {
  for (const domain of doms) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      secure: isProd,
      sameSite: "lax",
      ...(httpOnly ? { httpOnly: true } : {}),
      ...(domain ? { domain } : {}),
    });
  }
  res.cookies.delete(name);
}

function clearAll(req: NextRequest, res: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  const host = req.nextUrl.hostname;
  const parent = baseDomain(host);
  const doms: (string | undefined)[] = [undefined, host, `.${parent}`]; // host-only, 정확호스트, 상위도메인

  // HttpOnly 쿠키
  const httpOnlyCookies = [COOKIE_NAME, "current_hospital_id", "current_hospital_slug"];
  // 브라우저 접근 쿠키
  const nonHttpOnlyCookies = ["msw_exp", "csrf", "msw_csrf"];

  for (const n of httpOnlyCookies) expire(res, n, doms, isProd, true);
  for (const n of nonHttpOnlyCookies) expire(res, n, doms, isProd, false);

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("next") ?? "/m/login";
  const res = NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
  return clearAll(req, res);
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  return clearAll(req, res);
}



