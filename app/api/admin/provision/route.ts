// app/api/admin/provision/route.ts
import { NextRequest, NextResponse } from "next/server";
import { provisionHospitalOwner } from "@/lib/provision";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await requireSession().catch(() => null);
  if (!me) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (me.role !== "MASTER_ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  const hospitalName = String(body?.hospitalName || "").trim();
  const ownerEmail = String(body?.ownerEmail || "").trim();
  const tempPassword = body?.tempPassword ? String(body.tempPassword) : undefined;

  if (!/^[a-z0-9-]{3,32}$/.test(slug) || !hospitalName || !/^[^@]+@[^@]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const result = await provisionHospitalOwner({ slug, hospitalName, ownerEmail, tempPassword });
  return NextResponse.json({ ok: true, ...result });
}
