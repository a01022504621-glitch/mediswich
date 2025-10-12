// app/api/public/[tenant]/company/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    const hospital = await resolveTenantHybrid(params.tenant);
    if (!hospital) return NextResponse.json({ ok: false, error: "Invalid tenant" }, { status: 200 });

    const codeRaw = (new URL(req.url).searchParams.get("code") ?? "").trim();
    if (!codeRaw) return NextResponse.json({ ok: false, error: "code is required" }, { status: 200 });

    const U = codeRaw.toUpperCase();
    const L = codeRaw.toLowerCase();

    // 1) 고객사(있으면 pick)
    const client = await prisma.client.findFirst({
      where: {
        hospitalId: hospital.id,
        OR: [{ code: codeRaw }, { code: U }, { code: L }],
      },
      select: { id: true, name: true, code: true },
    });

    // 2) 해당 코드로 노출 가능한 기업 패키지 존재 여부 (clientId / client.code / clientCode 모두 허용)
    const orConds: any[] = [
      { client: { code: codeRaw } },
      { client: { code: U } },
      { client: { code: L } },
      { clientCode: codeRaw as any },
      { clientCode: U as any },
      { clientCode: L as any },
    ];
    if (client) orConds.unshift({ clientId: client.id });

    const pkgCount = await prisma.package.count({
      where: {
        hospitalId: hospital.id,
        category: "CORP",
        visible: true,
        OR: orConds,
      },
    });

    if (pkgCount > 0) {
      return NextResponse.json(
        { ok: true, client: client ?? null, packages: { count: pkgCount } },
        { status: 200 }
      );
    }

    // 실패도 200으로 내려서 클라이언트가 data.ok로 판단
    return NextResponse.json({ ok: false }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

