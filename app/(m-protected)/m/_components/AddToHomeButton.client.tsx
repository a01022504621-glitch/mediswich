"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function AddToHomeButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault?.();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall as any);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall as any);
  }, []);

  const onClick = async () => {
    if (deferredPrompt?.prompt) {
      await deferredPrompt.prompt();
      // 선택 결과는 필요 시 사용
      setDeferredPrompt(null);
    } else {
      alert("바탕화면 바로가기는 추후 PWA 설치로 제공됩니다.");
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg px-3 py-2 hover:bg-white/10"
    >
      바탕화면에 바로가기 추가
    </button>
  );
}

