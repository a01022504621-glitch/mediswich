export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/jwt";

function kill(res: NextResponse, name: string, opts: { httpOnly?: boolean }) {
  const secure = process.env.NODE_ENV === "production";
  const base = { secure, sameSite: "lax" as const, path: "/", httpOnly: !!opts.httpOnly };

  // host-only
  res.cookies.set(name, "", { ...base, maxAge: 0, expires: new Date(0) });
  // domain cookie
  if (secure) {
    res.cookies.set(name, "", { ...base, maxAge: 0, expires: new Date(0), domain: ".mediswich.co.kr" });
  }
  // API helper delete (best effort)
  res.cookies.delete(name);
}

function clearCookies(res: NextResponse) {
  kill(res, COOKIE_NAME, { httpOnly: true });
  kill(res, "msw_exp", { httpOnly: false });
  kill(res, "current_hospital_id", { httpOnly: true });
  kill(res, "current_hospital_slug", { httpOnly: true });

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function GET(req: NextRequest) {
  const returnTo = new URL(req.nextUrl).searchParams.get("next") ?? "/m/login";
  const res = NextResponse.redirect(new URL(returnTo, req.url));
  return clearCookies(res);
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  return clearCookies(res);
}

