// app/(m-protected)/m/_components/SessionTimer.client.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function format(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionTimer() {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const ticking = useRef<NodeJS.Timeout | null>(null);
  const lastPing = useRef<number>(0);

  // 처음 만료 상태 불러오기
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/status", { cache: "no-store" });
        if (!alive) return;
        if (r.ok) {
          const { remaining } = await r.json();
          setRemaining(remaining ?? 0);
        } else {
          setRemaining(0);
        }
      } catch {
        setRemaining(0);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 1초 카운트다운
  useEffect(() => {
    if (ticking.current) clearInterval(ticking.current);
    ticking.current = setInterval(() => {
      setRemaining((v) => (v == null ? v : Math.max(0, v - 1)));
    }, 1000);
    return () => { if (ticking.current) clearInterval(ticking.current); };
  }, []);

  // 활동 이벤트 → 디바운스 갱신 (최대 30초에 1번)
  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      if (now - lastPing.current < 30_000) return;
      lastPing.current = now;
      fetch("/api/auth/refresh", { method: "POST" })
        .then(async (r) => {
          if (!r.ok) return;
          const st = await fetch("/api/auth/status", { cache: "no-store" });
          if (st.ok) {
            const { remaining } = await st.json();
            setRemaining(remaining ?? null);
          }
        })
        .catch(() => {});
    };

    const evts: (keyof DocumentEventMap)[] = [
      "click", "keydown", "mousemove", "scroll", "visibilitychange"
    ];
    evts.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    return () => evts.forEach((e) => document.removeEventListener(e, handler));
  }, []);

  // 만료 시 자동 로그아웃
  useEffect(() => {
    if (remaining === 0) {
      alert("세션이 만료되어 로그아웃됩니다.");
      window.location.href = "/api/auth/logout";
    }
  }, [remaining]);

  if (remaining == null) return null;

  const warn = remaining <= 60;
  return (
    <div
      title="활동이 없으면 자동으로 만료됩니다"
      className={`text-xs font-medium ${warn ? "text-red-600" : "text-slate-600"}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      ⏱ {format(remaining)}
    </div>
  );
}
