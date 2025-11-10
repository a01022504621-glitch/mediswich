// /app/(m-protected)/m/layout.tsx
import "server-only";
import { Bell, History, User } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import CurrentLocation from "./_components/CurrentLocation.client";
import SidebarNav from "./_components/SidebarNav.client";
import AddToHomeButton from "./_components/AddToHomeButton.client";
import SessionTimer from "./_components/SessionTimer.client";

const NAV_GROUPS: { group: string; items: { label: string; href: string }[] }[] = [
  { group: "홈", items: [{ label: "대시보드", href: "/m/dashboard" }, { label: "실시간 검진현황", href: "/m/realtime" }] },
  { group: "기관관리", items: [{ label: "내 병원 설정", href: "/m/org/settings" }, { label: "케파 설정", href: "/m/org/capacity" }, { label: "결제/구독", href: "/m/billing" }] },
  { group: "고객사관리", items: [{ label: "고객사 등록", href: "/m/clients/new" }, { label: "고객사 검진 현황", href: "/m/clients/status" }] },
  { group: "패키지관리", items: [{ label: "공단검진 패키지 등록", href: "/m/packages/nhis" }, { label: "종합검진 패키지 등록", href: "/m/packages/general" }, { label: "기업검진 패키지 등록", href: "/m/packages/corp" }, { label: "추가검사 항목 등록", href: "/m/packages/addons" }] },
  { group: "백신관리", items: [{ label: "백신상품", href: "/m/vaccines/items" }, { label: "백신예약", href: "/m/vaccines/reservations" }] },
  { group: "알림", items: [{ label: "알림함", href: "/m/notifications" }] },
];

// 병원명 해석: DB(hid) → 쿠키 후보 → 폴백
async function getHospitalName(session: any): Promise<string> {
  const ck = cookies();
  const hid =
    ck.get("current_hospital_id")?.value ||
    session?.hid ||
    session?.hospitalId ||
    "";

  if (hid) {
    const org = await prisma.hospital.findUnique({
      where: { id: hid },
      select: { name: true },
    });
    if (org?.name) return org.name;
  }

  const nameKeys = ["hospitalName", "orgName", "x-hospital-name", "x-org-name", "mediswich_org_name"];
  for (const k of nameKeys) {
    const v = ck.get(k)?.value;
    if (v) return decodeURIComponent(v);
  }
  return "검진센터";
}

function TopButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch={false} className="group flex flex-col items-center gap-1">
      <span className="rounded-2xl bg-white/80 shadow-sm ring-1 ring-slate-200 px-3 py-2 backdrop-blur transition hover:bg-white hover:shadow-md hover:ring-slate-300">
        {children}
      </span>
      <span className="text-[11px] leading-none text-slate-500 group-hover:text-slate-700 transition">{label}</span>
    </Link>
  );
}

export default async function Layout({ children }: { children: ReactNode }) {
  const s = await requireSession();

  const me = await prisma.user.findUnique({ where: { id: s.sub }, select: { mustChangePassword: true } });
  if (me?.mustChangePassword) redirect("/m/me/change-password?first=1");

  const hospitalName = await getHospitalName(s);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <aside className="sticky top-0 h-screen w-64 shrink-0 border-r bg-gradient-to-b from-[#1e3a8a] to-[#0ea5e9] text-white">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4">
            <div className="h-6 w-6 rounded bg-white/90" />
            <div className="text-lg font-semibold tracking-tight">MediSwich</div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-2">
            <SidebarNav groups={NAV_GROUPS} />
          </nav>
          <div className="shrink-0 m-4 rounded-2xl bg-white/10 p-3 text-sm text-white/90 shadow-inner ring-1 ring-white/15 backdrop-blur">
            <ul className="space-y-1">
              <li><Link href="/m/notices" className="block rounded-lg px-3 py-2 hover:bg-white/10">공지사항</Link></li>
              <li><Link href="/m/manual" className="block rounded-lg px-3 py-2 hover:bg-white/10">메뉴얼 바로가기</Link></li>
              <li><Link href="/m/faq" className="block rounded-lg px-3 py-2 hover:bg-white/10">FAQ/문의하기</Link></li>
              <li><AddToHomeButton /></li>
              <li className="pt-1"><a href="/api/auth/logout?next=/m/login" className="block rounded-lg px-3 py-2 hover:bg-white/10">로그아웃</a></li>
            </ul>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-30 shrink-0 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <CurrentLocation className="max-w-[70vw] truncate bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 bg-clip-text text-transparent text-[20px] md:text-[24px] font-semibold tracking-tight" />
            <div className="flex items-end gap-5">
              <SessionTimer />
              <div className="hidden sm:block text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{hospitalName}</span> 관리자님, 환영해요!
              </div>
              <div className="flex items-end gap-4">
                <TopButton href="/#" label="히스토리"><History className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /></TopButton>
                <TopButton href="/m/notifications" label="알림"><Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /></TopButton>
                <TopButton href="/m/profile" label="내정보"><User className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /></TopButton>
              </div>
            </div>
          </div>
        </header>
        <main className="hide-inner-title min-w-0 flex-1 overflow-y-auto px-4 md:px-6 py-4">{children}</main>
      </div>
    </div>
  );
}


