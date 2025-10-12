// app/api/debug-cookies/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CSRF_COOKIE } from "@/lib/auth/csrf";

export async function GET() {
  const jar = cookies();
  const csrf = !!jar.get(CSRF_COOKIE)?.value;
  const cookieName = process.env.COOKIE_NAME || "msw_m";
  const hasSession = !!jar.get(cookieName)?.value;
  const sessionLen = jar.get(cookieName)?.value?.length || 0;
  return NextResponse.json({
    ok: true,
    has_csrf: csrf,
    has_session: hasSession,
    session_len: sessionLen,
    cookie_name: cookieName,
    note: "개발 중 확인용 엔드포인트입니다. 운영 전 삭제하세요.",
  });
}

