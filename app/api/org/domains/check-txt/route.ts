export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/org/domains/check-txt/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireOrg } from "@/lib/auth";
import { resolveTxt } from "dns/promises";
import crypto from "crypto";

function tokenFor(host: string, hospitalId: string) {
  const salt = process.env.DOMAIN_VERIFY_SALT || "dev-salt";
  return crypto.createHash("sha256").update(`${hospitalId}::${host}::${salt}`).digest("hex");
}
function nameFor(host: string) {
  return `_ms-verify.${host}`;
}

export async function POST(req: Request) {
  const org = await requireOrg();
  const ct = req.headers.get("content-type") || "";
  let host = "";
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    host = String(j.host || "");
  } else {
    const text = await req.text();
    // form-encoded or raw key=value
    const m = text.match(/host=([^&]+)/);
    host = m ? decodeURIComponent(m[1]) : "";
  }

  const clean = host.trim().toLowerCase();
  if (!clean || !clean.includes(".")) {
    return NextResponse.json({ ok: false, error: "invalid host" }, { status: 400 });
  }

  const domain = await prisma.hospitalDomain.findUnique({ where: { host: clean } });
  if (!domain || domain.hospitalId !== org.id) {
    return NextResponse.json({ ok: false, error: "host not found" }, { status: 404 });
  }

  const expected = tokenFor(clean, org.id);
  const name = nameFor(clean);

  try {
    const records = await resolveTxt(name); // [[ 'value1', 'value2' ], ... ]
    const flat = records.flat().map((s) => s.replace(/^"|"$/g, ""));
    const match = flat.some((v) => v.trim() === expected);
    if (!match) {
      return NextResponse.json({ ok: false, verified: false, reason: "TXT not matched" }, { status: 200 });
    }

    await prisma.hospitalDomain.update({
      where: { id: domain.id },
      data: { verifiedAt: new Date() },
    });

    return NextResponse.json({ ok: true, verified: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, verified: false, error: String(e?.message || e) }, { status: 200 });
  }
}


