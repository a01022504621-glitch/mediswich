// /app/(r-public)/r/[tenant]/page.tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";
import CatalogClient from "./_components/CatalogClient.client";

export const revalidate = 120; // 공개 랜딩은 ISR로 2분 캐시

function sanitize(html?: string) {
  return String(html ?? "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export default async function RLanding({ params }: { params: { tenant: string } }) {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const t = await resolveTenantHybrid({ slug: params.tenant, host });
  if (!t) notFound();

  const hospital = await prisma.hospital.findUnique({
    where: { id: t.id },
    select: { slug: true, name: true, noticeHtml: true },
  });
  if (!hospital) notFound();

  const notice = sanitize(hospital.noticeHtml ?? undefined);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gray-50">
      {/* 배경 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-60 -left-60 h-[800px] w-[800px] rounded-full blur-[120px] opacity-20"
          style={{ background: "radial-gradient(closest-side, #bfdbfe, transparent)" }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-[35vh]"
          style={{ background: "linear-gradient(180deg, rgba(249,250,251,0) 0%, rgba(249,250,251,1) 100%)" }}
        />
      </div>

      <div className="mx-auto w-full max-w-xl p-3 sm:p-5">
        {/* 헤더 + 공지 */}
        <section className="rounded-xl bg-white/95 backdrop-blur-md shadow-lg ring-1 ring-slate-100">
          <div className="rounded-t-xl bg-white/95 px-4 py-4 backdrop-blur-md">
            <div className="text-center">
              <div className="text-blue-600 text-[10px] font-semibold tracking-widest uppercase">
                {hospital.name} 검진 예약
              </div>
              <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900">Health Checkup Center</h1>
            </div>
          </div>

          {notice ? (
            <div className="px-4 pb-4 pt-0">
              <div className="rounded-lg bg-gray-50 p-3 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-red-500">📢 공지</span>
                  <div className="h-0.5 w-1 rounded-full bg-red-500" />
                </div>
                <div
                  className="mt-1 max-h-40 overflow-auto text-sm leading-snug text-slate-700"
                  dangerouslySetInnerHTML={{ __html: notice }}
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* 카탈로그 */}
        <section className="mt-1">
          <CatalogClient slug={hospital.slug} hospitalName={hospital.name} />
        </section>
      </div>
    </main>
  );
}
