'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

function Overlay() {
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-white/80 backdrop-blur-sm pointer-events-auto">
      <div className="h-12 w-12 rounded-full border-4 border-gray-300 border-t-gray-900 animate-spin" />
      <p className="mt-4 text-sm text-gray-600">페이지 불러오는 중…</p>
    </div>
  );
}

export default function RouteLoader() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const armTimer = useRef<number | null>(null);     // 지연 노출 타이머
  const safetyTimer = useRef<number | null>(null);  // 안전 종료 타이머
  const lastClickAt = useRef<number>(0);

  // 공통 유틸
  const currentURL = () => {
    const { pathname, search, hash } = window.location;
    return pathname + search + hash;
  };

  const isSameURL = (href: string) => {
    try {
      const u = new URL(href, window.location.origin);
      return (u.pathname + u.search + u.hash) === currentURL();
    } catch {
      return false;
    }
  };

  const arm = (reason?: string) => {
    // 너무 빠른 재클릭(더블클릭) 무시
    const now = Date.now();
    if (now - lastClickAt.current < 250) return;
    lastClickAt.current = now;

    // 이미 대기 중이면 재무장하지 않음
    if (armTimer.current || show) return;

    // 1) 120ms 뒤에 보여주기(짧은 전환은 안 보이게)
    armTimer.current = window.setTimeout(() => {
      setShow(true);
      armTimer.current = null;

      // 2) 경로가 안 바뀌는 “같은 페이지 재진입” 방지용 안전 종료(최대 1500ms)
      if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
      safetyTimer.current = window.setTimeout(() => {
        setShow(false);
        safetyTimer.current = null;
      }, 1500);
    }, 120);
  };

  const disarm = () => {
    if (armTimer.current) {
      window.clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    if (safetyTimer.current) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
    if (show) setShow(false);
  };

  // 1) 내부 a[href] 클릭 감지
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;

      // 새창/다운로드/수정키/중클릭/외부 링크 제외
      const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      const isMiddleClick = e.button === 1;
      if (isModified || isMiddleClick) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (!a.href.startsWith(window.location.origin)) return;

      // **같은 URL이면 오버레이 켜지지 않음**
      if (isSameURL(a.href)) return;

      arm('anchor');
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // 2) history API 래핑: router.push/replace도 감지
  useEffect(() => {
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    // @ts-ignore
    history.pushState = function (state, title, url) {
      // **같은 URL이면 무시**
      if (typeof url === 'string' && isSameURL(url)) {
        return origPush.apply(this, arguments as any);
      }
      arm('pushState');
      return origPush.apply(this, arguments as any);
    };
    // @ts-ignore
    history.replaceState = function (state, title, url) {
      if (typeof url === 'string' && isSameURL(url)) {
        return origReplace.apply(this, arguments as any);
      }
      arm('replaceState');
      return origReplace.apply(this, arguments as any);
    };

    // 뒤로가기/앞으로가기(popstate) 동안 체감상 멈춤 보일 수 있어 arm
    const onPop = () => arm('popstate');
    window.addEventListener('popstate', onPop);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  // 3) 경로가 실제로 바뀌면 다음 프레임에 OFF
  useEffect(() => {
    // 경로 변경 신호 → 안전하게 해제
    if (armTimer.current || show) {
      requestAnimationFrame(() => disarm());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return show ? <Overlay /> : null;
}
