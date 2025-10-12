// /app/api/auth/refresh/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt, signSession, sessionCookie, expCookie, SESSION_TTL_SEC, COOKIE_NAME } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const ck = cookies();
  const token = ck.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, reason: "NO_TOKEN" }, { status: 401 });

  try {
    const payload = await verifyJwt(token);
    const newToken = await signSession({
      sub: payload.sub,
      role: payload.role,
      hospitalId: payload.hospitalId,
      hospitalSlug: payload.hospitalSlug,
    });

    const res = NextResponse.json({ ok: true, ttl: SESSION_TTL_SEC });
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
    const sc = sessionCookie(newToken, SESSION_TTL_SEC);
    const ec = expCookie(exp);
    res.cookies.set(sc.name, sc.value, sc.options);
    res.cookies.set(ec.name, ec.value, ec.options);
    return res;
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID" }, { status: 401 });
  }
}


