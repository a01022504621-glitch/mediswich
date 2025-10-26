export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/auth/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth/jwt";
import { COOKIE_NAME } from "@/lib/auth/jwt";

export async function GET() {
  const ck = await cookies();
  const token = ck.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const payload = await verifyJwt(token);
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp ?? now;
    return NextResponse.json({ ok: true, now, exp, remaining: Math.max(0, exp - now) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}


