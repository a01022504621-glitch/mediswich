// app/(m-protected)/m/org/settings/_components/CopyPublicUrl.client.tsx
"use client";

export default function CopyPublicUrl({
  path,
  className,
}: {
  path: string; // 반드시 "/r/[slug]" 같은 상대경로
  className?: string;
}) {
  const makeAbsolute = () => `${location.origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(makeAbsolute());
      alert("주소가 복사됐어요.");
    } catch {
      prompt("복사 실패. 수동으로 복사하세요:", makeAbsolute());
    }
  };

  const preview = () => {
    // 새 탭으로 절대URL 열기
    window.open(makeAbsolute(), "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        복사
      </button>
      <button
        type="button"
        onClick={preview}
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        미리보기
      </button>
    </div>
  );
}

