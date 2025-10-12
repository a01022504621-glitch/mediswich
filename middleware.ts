// /middleware.ts (교체본)
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};

const COOKIE = process.env.COOKIE_NAME || "msw_m";

function isAuthed(req: NextRequest) {
  return Boolean(req.cookies.get(COOKIE));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProd = process.env.NODE_ENV === "production";
  const isApi = pathname.startsWith("/api/");

  // 공개 경로 화이트리스트
  const isPublic =
    pathname === "/" ||
    pathname === "/m/login" ||
    pathname.startsWith("/r") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/csrf";

  // 보호 대상
  const needAuth = !isPublic && (pathname.startsWith("/m") || pathname.startsWith("/api/m"));

  // 인증 가드
  if (needAuth && !isAuthed(req)) {
    if (isApi) {
      return new NextResponse(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    const to = req.nextUrl.clone();
    to.pathname = "/m/login";
    // /m/login을 next로 주지 않도록 정규화
    const next = pathname.startsWith("/m/login") ? "/m/dashboard" : pathname;
    to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }

  // 이미 로그인 상태로 /m/login 접근 시 대시보드로
  if (pathname === "/m/login" && isAuthed(req)) {
    const to = req.nextUrl.clone();
    to.pathname = "/m/dashboard";
    to.search = "";
    return NextResponse.redirect(to);
  }

  const res = NextResponse.next();

  // 공용 헤더
  res.headers.set("x-url", req.nextUrl.toString());
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  if (isProd) res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // CSP(개발 중 http 다움만 허용)
  const devScript = isProd ? [] : ["'unsafe-eval'", "'unsafe-inline'"];
  const devStyle = isProd ? [] : ["'unsafe-inline'"];
  const httpDaum = isProd ? [] : ["http://*.daumcdn.net", "http://*.daum.net"];
  const csp = [
    "default-src 'self'",
    `script-src ${["'self'", "https://t1.daumcdn.net", "https://ssl.daumcdn.net", ...devScript].join(" ")}`,
    `style-src ${["'self'", ...devStyle].join(" ")}`,
    `img-src ${["'self'", "data:", "blob:", "https://*.daumcdn.net", "https://*.daum.net", ...httpDaum].join(" ")}`,
    `font-src 'self' data:`,
    `connect-src ${["'self'", ...(isProd ? [] : ["ws:", "http://localhost:3000"])].join(" ")}`,
    `frame-src ${["'self'", "https://*.daum.net", "https://*.daumcdn.net", ...httpDaum].join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  // 공개 API 캐시
  if (pathname.startsWith("/api/public/")) {
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
  }

  return res;
}

