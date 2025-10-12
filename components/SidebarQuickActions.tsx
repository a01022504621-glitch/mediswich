"use client";

import Link from "next/link";
import React from "react";

export default function SidebarQuickActions() {
  const handleAddToHome = () => {
    // 브라우저 별 홈화면 추가 안내 (간단 가이드)
    alert("브라우저의 [공유/더보기] > '홈 화면에 추가' 기능을 이용해 주세요.");
  };

  return (
    <div className="space-y-2">
      <Link href="/m/notices" className="block text-sm text-white/90 hover:underline">
        공지사항
      </Link>
      <Link href="/m/help/manual" className="block text-sm text-white/90 hover:underline">
        메뉴얼 바로가기
      </Link>
      <Link href="/m/help/faq" className="block text-sm text-white/90 hover:underline">
        FAQ/문의하기
      </Link>

      <button
        type="button"
        onClick={handleAddToHome}
        className="block w-full text-left text-sm text-white/90 hover:underline"
      >
        바탕화면에 바로가기 추가
      </button>

      <form action="/api/auth/logout" method="post" className="pt-2">
        <button className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15">
          로그아웃
        </button>
      </form>
    </div>
  );
}



