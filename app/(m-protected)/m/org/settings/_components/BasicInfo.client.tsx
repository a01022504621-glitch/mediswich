"use client";

export default function BasicInfo({
  hospitalName,
  slug,
}: {
  hospitalName: string;
  slug: string;
}) {
  // 읽기 전용 표기 값
  const fullUrl = `https://${slug}.mediswich.co.kr`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      alert("주소가 복사됐어요.");
    } catch {
      prompt("복사 실패. 수동으로 복사하세요:", fullUrl);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 병원명 (읽기 전용) */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-600">병원명</label>
        <div className="input bg-gray-50 pointer-events-none select-text">{hospitalName}</div>
      </div>

      {/* 예약자페이지 주소 (읽기 전용, 절대 URL 형식) */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-600">예약자페이지 주소</label>
        <div className="flex gap-2">
          <div className="input bg-gray-50 grow pointer-events-none select-text">
            {fullUrl}
          </div>
          <button className="btn btn-ghost whitespace-nowrap" onClick={copy}>
            복사
          </button>
          <a className="btn whitespace-nowrap" href={fullUrl} target="_blank" rel="noreferrer">
            미리보기
          </a>
        </div>
      </div>
    </div>
  );
}

