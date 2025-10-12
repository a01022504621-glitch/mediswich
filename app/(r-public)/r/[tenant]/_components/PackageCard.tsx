// app/(r-public)/r/[tenant]/_components/PackageCard.tsx
import Link from "next/link";

export default function PackageCard({
  href,
  name,
  summary,
  price,
  basicCount,
  optionalCount,
}: {
  href: string;
  name: string;
  summary?: string;
  price?: number | null;
  basicCount?: number;
  optionalCount?: number;
}) {
  const priceText =
    typeof price === "number" ? new Intl.NumberFormat("ko-KR").format(price) + "원" : undefined;

  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-[15px] font-semibold text-gray-900">{name}</div>
          {priceText && (
            <span className="shrink-0 rounded-full bg-[hsl(var(--brand))]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--brand))]">
              {priceText}
            </span>
          )}
        </div>
        {summary && <div className="mt-1 truncate text-sm text-gray-700">{summary}</div>}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {typeof basicCount === "number" && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
              기본 {basicCount}
            </span>
          )}
          {typeof optionalCount === "number" && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
              선택 {optionalCount}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 rounded-xl bg-[hsl(var(--brand))] px-4 py-2 text-sm font-semibold text-white">
        날짜 선택 →
      </div>
    </Link>
  );
}

