export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/jwt";

function expireAll(res: NextResponse, name: string, opts: { httpOnly?: boolean }) {
  const isProd = process.env.NODE_ENV === "production";
  const domains: (string | undefined)[] = [undefined, isProd ? ".mediswich.co.kr" : undefined];
  const paths = ["/", "/m", "/m/"];

  for (const domain of domains) {
    for (const path of paths) {
      res.cookies.set(name, "", {
        httpOnly: !!opts.httpOnly,
        sameSite: "lax",
        secure: isProd,
        path,
        maxAge: 0,
        expires: new Date(0),
        ...(domain ? { domain } : {}),
      });
    }
  }
  // best-effort
  res.cookies.delete(name);
}

function clearAll(res: NextResponse) {
  expireAll(res, COOKIE_NAME, { httpOnly: true });
  expireAll(res, "msw_exp", { httpOnly: false });
  expireAll(res, "current_hospital_id", { httpOnly: true });
  expireAll(res, "current_hospital_slug", { httpOnly: true });

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function GET(req: NextRequest) {
  const returnTo = new URL(req.nextUrl).searchParams.get("next") ?? "/m/login";
  const res = NextResponse.redirect(new URL(returnTo, req.url));
  return clearAll(res);
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  return clearAll(res);
}

