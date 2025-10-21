// app/(m-protected)/m/org/settings/page.tsx
import type { ReactNode } from "react";
import BasicInfo from "./_components/BasicInfo.client";
import PatientPageCustomizer from "./_components/PatientPageCustomizer.client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

/** 공통 카드 */
function SectionCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center justify-between rounded-t-2xl border-b border-slate-200/80 bg-slate-50/70 px-4 md:px-6 py-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-slate-800">{title}</div>
          {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div className="px-4 md:px-6 py-5">{children}</div>
    </section>
  );
}

export default async function Page() {
  // 세션의 병원 ID 확보
  const sess = await requireSession();
  const hid = (sess as any)?.hospitalId || (sess as any)?.hid;

  // DB에서 읽기: 이름/슬러그는 읽기전용 표기
  const hospital = hid
    ? await prisma.hospital.findUnique({
        where: { id: String(hid) },
        select: { name: true, slug: true },
      })
    : null;

  const hospitalName = hospital?.name ?? "검진센터";
  const slug = hospital?.slug ?? "hihospital";

  return (
    <div className="space-y-6">
      {/* 기본정보 (읽기 전용) */}
      <SectionCard
        title="기본정보"
        subtitle="병원명과 예약자페이지 주소는 계약 시 확정된 값입니다."
      >
        <BasicInfo hospitalName={hospitalName} slug={slug} />
      </SectionCard>

      {/* 공지/디자인 편집 + 우측 모바일 미리보기(휴대폰 목업 포함) */}
      <SectionCard
        title="병원 안내 공지 · 디자인"
        subtitle="예약자페이지 홈 공지 섹션. 템플릿과 색상을 선택하고 내용을 입력하세요."
        className="h-full"
      >
        <PatientPageCustomizer />
      </SectionCard>
    </div>
  );
}


