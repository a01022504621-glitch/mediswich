"use client";

export default function BasicInfo({
  hospitalName,
  slug,
}: {
  hospitalName: string;
  slug: string;
}) {
  const path = `/r/${slug}`; // 화면엔 항상 이 문자열만 보여주기 (SSR/CSR 동일)

  const copy = async () => {
    const abs = `${location.origin}${path}`; // 동작 시에만 절대URL 생성
    try {
      await navigator.clipboard.writeText(abs);
      alert("주소가 복사됐어요.");
    } catch {
      prompt("복사 실패. 수동으로 복사하세요:", abs);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 병원명 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-600">병원명</label>
        <div className="input bg-gray-50 pointer-events-none select-text">
          {hospitalName}
        </div>
      </div>

      {/* 예약자페이지 주소 + 액션 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-600">예약자페이지 주소</label>
        <div className="flex gap-2">
          {/* 화면엔 상대경로만 출력 → 수화 불일치 없음 */}
          <div className="input bg-gray-50 grow pointer-events-none select-text">
            {path}
          </div>
          <button className="btn btn-ghost whitespace-nowrap" onClick={copy}>복사</button>
          {/* 미리보기는 상대경로 링크여도 새 탭에서 자동으로 절대URL로 열림 */}
          <a className="btn whitespace-nowrap" href={path} target="_blank" rel="noreferrer">미리보기</a>
        </div>
      </div>
    </div>
  );
}


