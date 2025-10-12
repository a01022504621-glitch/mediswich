// app/(m-protected)/m/org/settings/_components/BasicInfo.server.tsx
import "server-only";
import { prisma } from "@/lib/prisma";
import { getCtx } from "@/lib/tenant";
import CopyPublicUrl from "./CopyPublicUrl.client";

export default async function BasicInfoCard() {
  const { hid } = await getCtx();
  const hospital = await prisma.hospital.findUnique({
    where: { id: hid },
    select: { name: true, slug: true },
  });

  const slug = hospital?.slug || "hospital";
  const path = `/r/${slug}`; // ← SSR/CSR 동일 문자열(상대경로)

  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">기본정보</h2>

      <label className="mb-1 block text-sm text-slate-600">병원명</label>
      <input
        className="mb-4 w-full rounded-lg border px-3 py-2 text-sm"
        defaultValue={hospital?.name ?? ""}
        readOnly
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label className="mb-1 block text-sm text-slate-600">
            예약자페이지 주소 (미리보기)
          </label>
          {/* 화면에는 상대경로만 출력 → 수화 불일치 없음 */}
          <code className="block max-w-[520px] truncate rounded-lg border bg-slate-50 px-3 py-2 text-sm">
            {path}
          </code>
        </div>

        {/* 복사/미리보기는 클라에서 절대URL 생성 */}
        <CopyPublicUrl path={path} />
      </div>
    </section>
  );
}


