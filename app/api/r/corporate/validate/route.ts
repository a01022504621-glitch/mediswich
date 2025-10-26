export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/r/corporate/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { resolveHospitalId, validateCorporateCode } from "@/lib/repos/packages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenant: string | undefined = body?.tenant;
    const code: string | undefined = body?.code;

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      undefined;

    if (!tenant && !host) {
      return NextResponse.json({ ok: false, error: "NO_TENANT_OR_HOST" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ ok: false, error: "NO_CODE" }, { status: 400 });
    }

    const hospitalId = await resolveHospitalId({ slug: tenant, host });
    const hit = await validateCorporateCode(hospitalId, code);

    if (!hit) {
      return NextResponse.json({ ok: true, valid: false });
    }

    return NextResponse.json({
      ok: true,
      valid: true,
      client: {
        id: hit.id,
        name: hit.name,
        code: hit.code,
        directUrl: hit.directUrl ?? null,
        startDate: hit.startDate ?? null,
        endDate: hit.endDate ?? null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
