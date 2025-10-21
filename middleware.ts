// /middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

const ROOT = "mediswich.co.kr";
const COOKIE = process.env.COOKIE_NAME || "msw_m";

function isAuthed(req: NextRequest) {
  return Boolean(req.cookies.get(COOKIE));
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl;
  const origPath = url.pathname;
  const isProd = process.env.NODE_ENV === "production";

  const parts = host.split(".");
  const sub = parts.length > 2 ? parts[0] : "";

  const mapped = new URL(url);
  if (host.endsWith("." + ROOT)) {
    if (sub === "admin") {
      if (origPath === "/") mapped.pathname = "/m";
      else if (!origPath.startsWith("/m")) mapped.pathname = `/m${origPath}`;
    } else if (sub && sub !== "www") {
      if (origPath === "/") mapped.pathname = `/r/${sub}`;
      else if (!origPath.startsWith(`/r/${sub}`)) mapped.pathname = `/r/${sub}${origPath}`;
    }
  }

  const p = mapped.pathname;
  const isApi = p.startsWith("/api/");
  const isPublic =
    p === "/" ||
    p === "/m/login" ||
    p.startsWith("/r") ||
    p.startsWith("/api/public/") ||
    p.startsWith("/api/auth/") ||
    p === "/api/csrf";

  const needAuth = !isPublic && (p.startsWith("/m") || p.startsWith("/api/m"));

  if (needAuth && !isAuthed(req)) {
    if (isApi) {
      return new NextResponse(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    const to = new URL(mapped);
    to.pathname = "/m/login";
    to.searchParams.set("next", p.startsWith("/m/login") ? "/m/dashboard" : p);
    return NextResponse.redirect(to);
  }

  if (p === "/m/login" && isAuthed(req)) {
    const to = new URL(mapped);
    to.pathname = "/m/dashboard";
    to.search = "";
    return NextResponse.redirect(to);
  }

  const changed = p !== origPath;
  const res = changed ? NextResponse.rewrite(mapped) : NextResponse.next();

  res.headers.set("x-url", req.nextUrl.toString());
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  if (isProd) res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  const devScript = isProd ? [] : ["'unsafe-eval'"];
  const httpDaum = isProd ? [] : ["http://*.daumcdn.net", "http://*.daum.net"];

  const csp = [
    "default-src 'self'",
    `script-src ${["'self'", "'unsafe-inline'", "https://t1.daumcdn.net", "https://ssl.daumcdn.net", ...devScript].join(" ")}`,
    `style-src 'self' 'unsafe-inline'`, // ← 인라인 스타일 허용
    `img-src ${["'self'", "data:", "blob:", "https://*.daumcdn.net", "https://*.daum.net", "https://images.unsplash.com", ...httpDaum].join(" ")}`,
    `font-src 'self' data:`,
    `connect-src ${["'self'", ...(isProd ? [] : ["ws:", "http://localhost:3000"])].join(" ")}`,
    `frame-src ${["'self'", "https://*.daum.net", "https://*.daumcdn.net", ...httpDaum].join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  return res;
}

