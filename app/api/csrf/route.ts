export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/csrf/route.ts
import { NextResponse } from "next/server";
import { ensureCsrfCookie, CSRF_COOKIE } from "@/lib/auth/csrf";

export async function GET() {
  const token = ensureCsrfCookie();
  return NextResponse.json({ ok: true, token, cookie: CSRF_COOKIE });
}

