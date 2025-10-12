// app/(r-public)/r/[tenant]/layout.tsx
import "server-only";
import type { ReactNode } from "react";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";
import BootTenantCookie from "./_components/BootTenantCookie.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenant: string };
}) {
  // 수정: 문자열 → 객체 형태로 전달
  const hospital = await resolveTenantHybrid({ slug: params.tenant }).catch(() => null);

  const info = hospital
    ? { id: hospital.id, slug: hospital.slug, name: hospital.name }
    : null;

  return (
    <>
      {children}
      {info && <BootTenantCookie info={info} />}
    </>
  );
}


