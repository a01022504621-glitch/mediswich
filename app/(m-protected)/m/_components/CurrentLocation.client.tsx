"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function resolveLabel(path: string) {
  const MAP: Record<string, string> = {
    "/m/dashboard": "대시보드",
    "/m/realtime": "실시간 검진현황",

    "/m/org/settings": "내 병원 설정",
    "/m/org/capacity": "케파 설정",

    "/m/clients/new": "고객사 등록",
    "/m/clients/status": "고객사 검진 현황",

    "/m/packages/nhis": "공단검진 패키지 등록",
    "/m/packages/general": "종합검진 패키지 등록",
    "/m/packages/corp": "기업검진 패키지 등록",

    "/m/vaccines/items": "백신상품",
    "/m/vaccines/reservations": "백신예약",

    "/m/notifications": "알림함",
    "/m/profile": "내정보",
  };

  let best = "";
  for (const key of Object.keys(MAP)) {
    if (path === key || path.startsWith(key + "/")) {
      if (key.length > best.length) best = key;
    }
  }
  return MAP[best] ?? "";
}

export default function CurrentLocation({ className = "" }: { className?: string }) {
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const label = mounted ? resolveLabel(pathname) : "";

  // 항상 같은 요소를 렌더(서버/클라이언트 트리 동일)하고 텍스트만 마운트 후 채움
  return (
    <span
      suppressHydrationWarning
      className={
        className ||
        "text-[20px] md:text-[24px] font-semibold tracking-tight bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 bg-clip-text text-transparent"
      }
    >
      {label}
    </span>
  );
}

