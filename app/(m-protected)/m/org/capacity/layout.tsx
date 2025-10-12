// app/(m-protected)/m/org/capacity/layout.tsx
import type { ReactNode } from "react";
import { requireOrg } from "@/lib/auth";

export default async function Layout({ children }: { children: ReactNode }) {
  // 병원 컨텍스트만 확보 (실제 화면은 children)
  await requireOrg();

  // 결제 붙이기 전까지는 PRO 게이팅 off
  const isPro = true;

  return (
    <div>
      {/* isPro이 false일 때만 배너를 보여주면 됩니다. 지금은 무조건 통과 */}
      {children}
    </div>
  );
}

