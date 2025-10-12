"use client";
type Item = { label: string; active?: boolean; onClick: () => void };

export default function CategoryTabs({ items }: { items: Item[] }) {
  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          className={[
            "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
            it.active
              ? "bg-[color:var(--brand)] text-white shadow"
              : "text-gray-700 hover:bg-gray-50",
          ].join(" ")}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

