"use client";

export default function Logo({ className = "h-7 object-contain" }: { className?: string }) {
  // 정석은 배경이 투명한 PNG/SVG 사용.
  // 임시로 흰 배경 느낌 줄이기 위해 mix-blend 적용(그라데이션/컬러 배경에서 효과)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mediswitch-logo.png"
      alt="Mediswitch"
      className={className}
      style={{ mixBlendMode: "multiply" }}
    />
  );
}
