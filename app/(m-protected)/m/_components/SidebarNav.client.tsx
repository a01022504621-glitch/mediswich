"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Group = { group: string; items: { label: string; href: string }[] };

export default function SidebarNav({ groups }: { groups: Group[] }) {
  const pathname = usePathname() || "/";

  // 현재 경로가 속한 그룹 기본 오픈
  const defaultOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const g of groups) map[g.group] = false;
    for (const g of groups) {
      if (g.items.some((it) => pathname === it.href || pathname.startsWith(it.href + "/"))) {
        map[g.group] = true;
        break;
      }
    }
    return map;
  }, [groups, pathname]);

  const [open, setOpen] = useState<Record<string, boolean>>(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]); // 라우트 변경 시 동기화

  const toggle = (key: string) => setOpen((s) => ({ ...s, [key]: !s[key] }));

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const opened = !!open[g.group];
        return (
          <div key={g.group} className="select-none">
            {/* 그룹 헤더 (토글 버튼) */}
            <button
              type="button"
              onClick={() => toggle(g.group)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] uppercase tracking-wider
                         text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <span>{g.group}</span>
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition-transform ${opened ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* 하위 항목 리스트 (열림 상태에서만 렌더) */}
            {opened && (
              <ul className="mt-1 space-y-1 pl-1">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        prefetch={false}
                        className={[
                          "relative block rounded-lg px-3 py-2 text-sm transition",
                          active
                            ? "bg-white/15 text-white font-semibold ring-1 ring-white/25 shadow-inner"
                            : "text-white/80 hover:text-white hover:bg-white/10",
                        ].join(" ")}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-gradient-to-b from-cyan-300 to-sky-600" />
                        )}
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
