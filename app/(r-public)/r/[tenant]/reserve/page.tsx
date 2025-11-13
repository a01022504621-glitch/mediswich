// app/(r-public)/r/[tenant]/reserve/page.tsx
import { headers } from "next/headers";
import prisma from "@/lib/prisma-scope";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function catLabel(c?: string | null) {
  const u = String(c ?? "").toUpperCase();
  if (u === "NHIS") return "공단검진";
  if (u === "GENERAL") return "종합검진";
  if (u === "CORP") return "기업/단체";
  return "";
}

export default async function TenantReserve({
  params,
  searchParams,
}: {
  params: { tenant: string };
  searchParams: { packageId?: string; time?: string; date?: string };
}) {
  const host = headers().get("x-forwarded-host") ?? headers().get("host") ?? "";
  const t = await resolveTenantHybrid({ slug: params.tenant, host });
  if (!t) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">잘못된 병원 주소</h1>
        <p className="text-slate-600">병원을 찾을 수 없습니다.</p>
      </main>
    );
  }
  const tenantId = t.id;
  const tenantSlug = t.slug;

  const h = await prisma.hospital.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  if (!h) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">잘못된 병원 주소</h1>
        <p className="text-slate-600">병원을 찾을 수 없습니다.</p>
      </main>
    );
  }

  const pkg = searchParams.packageId
    ? await prisma.package.findFirst({
        where: { id: searchParams.packageId, hospitalId: tenantId, visible: true },
        select: { id: true, title: true, summary: true, price: true, category: true },
      })
    : null;

  const sub = await prisma.hospitalSubscription.findFirst({
    where: { hospitalId: tenantId, status: "ACTIVE" },
  });
  const subscriptionExpired = sub ? sub.currentPeriodEnd < new Date() : false;

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{h.name} - 예약 정보 입력</h1>
      </header>

      {!pkg && (
        <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
          상품이 선택되지 않았습니다.
        </p>
      )}
      {subscriptionExpired && (
        <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
          현재 병원의 구독이 만료되어 예약이 제한될 수 있습니다.
        </p>
      )}

      {pkg && (
        <div className="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-[11px] tracking-wide text-slate-500">선택된 상품</div>
          <div className="mt-1 font-semibold text-slate-900">{pkg.title}</div>
          <div className="mt-1 text-sm text-slate-600">{pkg.summary ?? ""}</div>
          <div className="mt-1 text-xs text-slate-500">검진유형: {catLabel(pkg.category as any) || "-"}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            당일 결제 비용: {(Number(pkg.price ?? 0) || 0).toLocaleString()}원
          </div>
        </div>
      )}

      {/* 예약 생성은 오직 공개 API를 통해서만 진행 */}
      <ReserveForm
        tenantSlug={tenantSlug}
        packageId={pkg?.id ?? ""}
        defaultDate={String(searchParams.date ?? "")}
        defaultTime={String(searchParams.time ?? "")}
        disabled={!pkg || subscriptionExpired}
      />

      <a href={`/r/${tenantSlug}`} className="mt-3 inline-block text-sm text-slate-600 underline">
        ← 예약자 랜딩으로
      </a>
    </main>
  );
}

// 분리된 클라이언트 컴포넌트
import ReserveForm from "./_components/ReserveForm.client";



