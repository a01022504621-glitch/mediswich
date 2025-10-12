export const dynamic = "force-dynamic";

import SpecialsEditor from "./ui/Specials.client";

export default function SpecialsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">특정검사 설정</h1>
      <SpecialsEditor />
    </section>
  );
}


