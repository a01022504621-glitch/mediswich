// app/loading.tsx
export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-white">
      <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-gray-900 animate-spin" />
      <p className="mt-4 text-sm text-gray-600">데이터를 불러오는 중입니다…</p>
    </div>
  );
}
