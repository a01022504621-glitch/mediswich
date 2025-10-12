export const dynamic = "force-dynamic";

import DefaultsEditor from "./ui/Defaults.client";

export default function DefaultsPage() {
  return (
    <section className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">기본 케파 설정</h1>
      <p className="text-sm text-slate-500">
        요일별 기본 슬롯과 리소스별(기본/공단/특수·특정검사) 기본 수용 인원을 설정합니다.
      </p>
      <DefaultsEditor />
    </section>
  );
}
