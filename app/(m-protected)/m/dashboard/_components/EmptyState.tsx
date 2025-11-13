// app/(m-protected)/m/dashboard/_components/EmptyState.tsx
"use client";

export default function EmptyState({ children }: { children?: React.ReactNode }) {
  return (
    <div className="grid h-56 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500">
      {children ?? "표시할 데이터가 없습니다."}
    </div>
  );
}


