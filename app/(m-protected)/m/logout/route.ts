// app/(m-protected)/m/logout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/jwt";

function expireAll(res: NextResponse, name: string, opts: { httpOnly?: boolean }) {
  const prod = process.env.NODE_ENV === "production";
  const domains: (string | undefined)[] = [undefined, prod ? ".mediswich.co.kr" : undefined];
  const paths = ["/", "/m", "/m/"];

  for (const domain of domains) {
    for (const path of paths) {
      res.cookies.set(name, "", {
        httpOnly: !!opts.httpOnly,
        sameSite: "lax",
        secure: prod,
        path,
        maxAge: 0,
        expires: new Date(0),
        ...(domain ? { domain } : {}),
      });
    }
  }
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
  const to = new URL(req.nextUrl);
  to.pathname = "/m/login";
  to.search = "";
  return clearAll(NextResponse.redirect(to));
}

