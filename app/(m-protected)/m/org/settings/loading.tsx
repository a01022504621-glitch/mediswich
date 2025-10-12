// app/(m-protected)/m/org/settings/loading.tsx
export default function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      <span className="ml-3 text-slate-500">페이지 불러오는 중…</span>
    </div>
  );
}

