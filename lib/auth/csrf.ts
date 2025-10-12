// lib/auth/csrf.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { randomBytes, timingSafeEqual } from "crypto";

export const CSRF_COOKIE = "msw_csrf";

// 브라우저가 읽을 수 있어야 하므로 HttpOnly 사용 금지!
export function ensureCsrfCookie() {
  const c = cookies().get(CSRF_COOKIE)?.value;
  if (c) return c;
  const token = randomBytes(32).toString("base64url");
  cookies().set(CSRF_COOKIE, token, {
    httpOnly: false, // ← 중요!
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1h
  });
  return token;
}

export function getCsrfFromCookie() {
  return cookies().get(CSRF_COOKIE)?.value || "";
}
export function getCsrfFromHeader() {
  return headers().get("x-csrf") || "";
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try { return timingSafeEqual(ab, bb); } catch { return false; }
}

export function assertCsrf() {
  const c = getCsrfFromCookie();
  const h = getCsrfFromHeader();
  if (!c || !h || !safeEqual(c, h)) {
    const err: any = new Error("Forbidden (CSRF)");
    err.status = 403;
    throw err;
  }
}



