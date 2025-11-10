// app/api/public/[tenant]/addons/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

/**
 * 공개용 추가검사 목록
 * - 기본: isActive=true만 노출
 * - ?code=기업코드 제공 시 해당 클라이언트 오버라이드 적용
 * - 응답: { items: [{ id, name, sex: 'A|M|F', code, price, priceKRW }] }
 */
export async function GET(req: NextRequest, context: { params: { tenant: string } }) {
  try {
    const { params } = context;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const t = await resolveTenantHybrid({ slug: params.tenant, host });
    if (!t) return NextResponse.json({ items: [] }, { status: 200 });

    const hospitalId = t.id;

    const url = new URL(req.url);
    const rawClientCode = (url.searchParams.get("code") || "").trim();
    let clientId: string | null = null;

    if (rawClientCode) {
      const variants = [rawClientCode, rawClientCode.toUpperCase(), rawClientCode.toLowerCase()];
      const client = await runAs(hospitalId, () =>
        prisma.client.findFirst({
          where: { hospitalId, code: { in: variants } },
          select: { id: true },
        }),
      );
      clientId = client?.id ?? null;
    }

    // 병원 마스터 추가검사(코드 포함)
    const baseItems = await runAs(hospitalId, () =>
      prisma.addonItem.findMany({
        where: { hospitalId, isActive: true },
        select: { id: true, name: true, sex: true, code: true, priceKRW: true },
        orderBy: { createdAt: "asc" },
      }),
    );

    // 기업 오버라이드 적용 맵
    let overrideMap = new Map<string, { enabled: boolean; priceKRW: number | null }>();
    if (clientId) {
      const overrides = await runAs(hospitalId, () =>
        prisma.addonItemClient.findMany({
          where: { clientId },
          select: { addonItemId: true, enabled: true, priceKRW: true },
        }),
      );
      overrideMap = new Map(overrides.map((o) => [o.addonItemId, { enabled: o.enabled, priceKRW: o.priceKRW ?? null }]));
    }

    const items = baseItems
      .map((it) => {
        const ov = overrideMap.get(it.id);
        if (ov && ov.enabled === false) return null;

        const price = ov?.priceKRW ?? it.priceKRW ?? null;
        const sexOut = it.sex === "M" || it.sex === "F" ? (it.sex as "M" | "F") : "A";

        return {
          id: it.id,
          name: it.name,
          sex: sexOut,            // 'A' | 'M' | 'F'
          code: it.code ?? null,  // ← 추가: 코드 포함
          price,                  // number | null
          priceKRW: price,        // 호환 필드
          visible: true,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch (e: any) {
    // 공개 API는 실패 시 빈 목록
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}


