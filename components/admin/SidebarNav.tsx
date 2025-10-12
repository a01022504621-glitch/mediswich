"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { label: string; href: string };
type Group = { group: string; items: Item[] };

export default function SidebarNav({
  groups,
  bottomUtilities,
}: {
  groups: Group[];
  bottomUtilities?: React.ReactNode;
}) {
  const pathname = usePathname();

  const initial: Record<string, boolean> = {};
  for (const g of groups) initial[g.group] = g.group === "홈";
  const [open, setOpen] = useState<Record<string, boolean>>(initial);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {groups.map((g) => {
          const isOpen = open[g.group];
          return (
            <div key={g.group} className="select-none">
              <button
                className="w-full flex items-center justify-between text-left text-[13px] font-semibold uppercase tracking-wide text-pink-100/80 px-2 py-1"
                onClick={() => setOpen((s) => ({ ...s, [g.group]: !s[g.group] }))}
              >
                <span>{g.group}</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                </svg>
              </button>

              {isOpen && (
                <ul className="mt-1 space-y-1">
                  {g.items.map((it) => {
                    const active = pathname === it.href || pathname.startsWith(it.href + "/");
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          className={`block rounded-lg px-3 py-2 text-sm ${
                            active
                              ? "bg-pink-800 text-white font-medium shadow-sm"
                              : "text-pink-100 hover:bg-white/10"
                          }`}
                        >
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
      {bottomUtilities}
    </div>
  );
}

