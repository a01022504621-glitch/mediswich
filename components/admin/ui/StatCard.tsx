"use client";

type StatCardProps = {
  title: string;
  value: number | string;
  hint?: string;
};
export default function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow transition-shadow">
      <div className="text-[12px] text-gray-500">{title}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}



