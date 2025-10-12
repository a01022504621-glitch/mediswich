// app/(m-protected)/m/org/settings/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <p className="text-red-600 font-semibold">오류가 발생했어요.</p>
      <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
        {error.message}
      </pre>
      <button
        onClick={reset}
        className="mt-3 rounded bg-slate-800 px-3 py-1 text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
