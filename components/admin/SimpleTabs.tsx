// components/admin/SimpleTabs.tsx
"use client";
import { useState } from "react";

export default function SimpleTabs({ tabs }: { tabs: { id: string; title: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find(t => t.id === active) || tabs[0];
  return (
    <div>
      <div className="border-b flex gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 text-sm rounded-t ${active === t.id ? "bg-white border-x border-t -mb-px" : "text-gray-600 hover:text-black"}`}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div className="border rounded-b bg-white p-4">{current?.content}</div>
    </div>
  );
}




