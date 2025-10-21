// app/(m-protected)/m/org/capacity/defaults/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import DefaultsEditor from "./ui/Defaults.client";

export default function DefaultsPage() {
  return (
    <section className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">기본 케파 설정</h1>
        <Link
          href="/m/org/capacity"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ← 케파 캘린더로
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        기본 케파와 특수검진 케파의 기본 수용 인원을 설정합니다. 특정검사 케파는 아래에서 항목별로 설정합니다.
      </p>
      <DefaultsEditor />
    </section>
  );
}
