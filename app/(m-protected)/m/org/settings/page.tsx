// app/(m-protected)/m/org/settings/page.tsx
import { cookies } from "next/headers";
import BasicInfo from "./_components/BasicInfo.client";
import NoticeForm from "./_components/HospitalNoticeForm.client";
import type { ReactNode } from "react";

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

export default function Page() {
  const ck = cookies();

  const hospitalName =
    ck.get("hospitalName")?.value || ck.get("orgName")?.value || "검진센터";

  const slug =
    ck.get("hospitalSlug")?.value || ck.get("orgSlug")?.value || "hihospital";

  return (
    <div className="space-y-6">
      {/* 기본정보 */}
      <SectionCard
        title="기본정보"
        subtitle="병원명과 예약자페이지 주소는 계약 시 확정된 값입니다."
      >
        <BasicInfo hospitalName={hospitalName} slug={slug} />
      </SectionCard>

      {/* 공지/디자인 편집 + 우측 모바일 미리보기(컴포넌트 내부 포함) */}
      <SectionCard
        title="병원 안내 공지 · 디자인"
        subtitle="예약자페이지 홈 공지 섹션. 템플릿과 색상을 선택하고 내용을 입력하세요."
        className="h-full"
      >
        <NoticeForm />
      </SectionCard>
    </div>
  );
}


