export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// app/api/org/domains/request-verify/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/session";
import crypto from "crypto";

/**
 * 결정적 토큰 설계로 DB 저장 불필요.
 * 이 API는 호스트를 등록/업서트하고, 안내용 TXT name/value만 반환.
 */

function tokenFor(host: string, hospitalId: string) {
  const salt = process.env.DOMAIN_VERIFY_SALT || "dev-salt";
  return crypto.createHash("sha256").update(`${hospitalId}::${host}::${salt}`).digest("hex");
}
function nameFor(host: string) {
  return `_ms-verify.${host}`;
}

export async function POST(req: Request) {
  const s = await requireSession();
  const hid = String((s as any).hid || (s as any).hospitalId || "");

  const { host } = await req.json().catch(() => ({ host: "" as string }));
  const clean = String(host || "").trim().toLowerCase();
  if (!clean || !clean.includes(".")) {
    return NextResponse.json({ ok: false, error: "invalid host" }, { status: 400 });
  }

  const exists = await prisma.hospitalDomain.findUnique({ where: { host: clean } });
  if (exists && exists.hospitalId !== hid) {
    return NextResponse.json({ ok: false, error: "host used by another hospital" }, { status: 409 });
  }
  if (!exists) {
    await prisma.hospitalDomain.create({ data: { hospitalId: hid, host: clean } });
  }

  const token = tokenFor(clean, hid);
  const name = nameFor(clean);
  return NextResponse.json({ ok: true, host: clean, txtName: name, txtValue: token });
}



