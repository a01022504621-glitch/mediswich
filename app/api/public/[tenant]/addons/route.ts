export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/public/[tenant]/addons/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";
 

export async function GET(req: NextRequest, context: { params: { tenant: string } }) {
  try {
    const { params } = context;
    const t = await resolveTenantHybrid({ slug: params.tenant, host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "" });
    if (!t) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
    const hospitalId = t.id;
    const hospital = t;
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").trim() || undefined;

    // (옵션) 기업코드 매칭
    let clientId: string | null = null;
    if (code) {
      const U = code.toUpperCase();
      const L = code.toLowerCase();
      const client = await runAs(hospitalId, () => prisma.client.findFirst({
        where: { hospitalId: hospital.id, code: { in: [code, U, L] } },
        select: { id: true },
      }));
      clientId = client?.id ?? null;
    }

    // 병원 마스터 추가검사
    const baseItems = await runAs(hospitalId, () => prisma.addonItem.findMany({
      where: { hospitalId: hospital.id, isActive: true },
      select: { id: true, name: true, sex: true, priceKRW: true },
      orderBy: { createdAt: "asc" },
    }));

    // 기업 코드가 있으면 클라이언트별 재정의 적용
    let overrideMap = new Map<string, { enabled: boolean; priceKRW: number | null }>();
    if (clientId) {
      const overrides = await runAs(hospitalId, () => prisma.addonItemClient.findMany({
        where: { clientId },
        select: { addonItemId: true, enabled: true, priceKRW: true },
      }));
      overrideMap = new Map(
        overrides.map((o) => [o.addonItemId, { enabled: o.enabled, priceKRW: o.priceKRW ?? null }]),
      );
    }

    const items = baseItems
      .map((it) => {
        const ov = overrideMap.get(it.id);
        // override가 비활성화면 제외
        if (ov && ov.enabled === false) return null;

        const price = ov?.priceKRW ?? it.priceKRW ?? 0;
        const sex = it.sex ? String(it.sex) as "M" | "F" : null;

        return {
          id: it.id,
          name: it.name,
          sex,                         // "M" | "F" | null
          price,                       // 숫자
          priceKRW: price,             // 호환 필드
          visible: true,               // 프런트에서 추가 필터 가능
        };
      })
      .filter(Boolean);

    // 프런트 호환: { items: [...] } 형태
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


