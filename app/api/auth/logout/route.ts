export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/jwt";

function clearCookies(res: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  const base = { secure, sameSite: "lax" as const, path: "/" };

  // 1) delete (Next 14 제공)
  res.cookies.delete(COOKIE_NAME);
  res.cookies.delete("msw_exp");

  // 2) 호환: 만료 쿠키로 덮어쓰기
  res.cookies.set(COOKIE_NAME, "", { ...base, httpOnly: true, maxAge: 0, expires: new Date(0) });
  res.cookies.set("msw_exp", "", { ...base, maxAge: 0, expires: new Date(0) });

  // 캐시 방지
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
