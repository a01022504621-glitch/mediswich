"use client";

import { usePathname } from "next/navigation";

const MAP: [string, string][] = [
  ["/m/dashboard", "대시보드"],
  ["/m/realtime", "실시간 검진현황"],
  ["/m/org/settings", "내 병원 설정"],
  ["/m/org/capacity", "케파 설정"],
  ["/m/clients/new", "고객사 등록"],
  ["/m/clients/status", "고객사 검진 현황"],
  ["/m/packages/nhis", "공단검진 패키지 등록"],
  ["/m/packages/general", "종합검진 패키지 등록"],
  ["/m/packages/corp", "기업검진 패키지 등록"],
  ["/m/vaccines/items", "백신 상품 등록"],
  ["/m/vaccines/reservations", "백신 예약 현황"],
  ["/m/notifications", "알림관리"],
];

const currentLabel = (p: string) => MAP.find(([k]) => p.startsWith(k))?.[1] ?? "메뉴";

export default function TopBar({ hospitalName }: { hospitalName: string }) {
  const pathname = usePathname() || "/";
  const title = currentLabel(pathname);

  return (
    <header
      className="
        sticky top-0 z-30 border-b shadow-[0_1px_0_rgba(0,0,0,0.04)]
        bg-white/65 backdrop-blur-xl backdrop-saturate-150
        supports-[backdrop-filter]:bg-white/50
      "
    >
      <div className="h-16 max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* 좌측: 브레드크럼 */}
        <nav className="flex items-center gap-2 text-[13px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[hsl(var(--brand))]">
              <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            홈
          </span>
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-400">
            <path fill="currentColor" d="M9 6l6 6-6 6z" />
          </svg>
          <span className="text-[15px] font-semibold text-gray-900 tracking-tight">{title}</span>
        </nav>

        {/* 우측: 병원명 + 인사 + 아이콘 라벨 */}
        <div className="flex items-end gap-8">
          <div className="leading-tight mr-1 text-right">
            <div className="text-[15px] font-bold tracking-tight text-gray-900">{hospitalName}</div>
            <div className="text-sm text-gray-600">관리자님, 환영해요!</div>
          </div>

          <div className="flex items-end gap-8">
            <a href="/m/history" className="group flex flex-col items-center gap-1 text-gray-600 hover:text-gray-900">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="currentColor" d="M12 8v5l3 3 1.5-1.5L13 12.7V8h-1Zm-7 4a7 7 0 1 0 14 0 7 7 0 0 0-14 0Zm-2 0a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" />
              </svg>
              <span className="text-xs">히스토리</span>
            </a>
            <a href="/m/notifications" className="group flex flex-col items-center gap-1 text-gray-600 hover:text-gray-900">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-4.5a7 7 0 0 0-5-6.71V4a2 2 0 1 0-4 0v.79A7 7 0 0 0 5 11.5V16l-2 2v1h18v-1l-2-2Z" />
              </svg>
              <span className="text-xs">알림</span>
            </a>
            <a href="/m/profile" className="group flex flex-col items-center gap-1 text-gray-600 hover:text-gray-900">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
              </svg>
              <span className="text-xs">내정보</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

