// app/(m-public)/m/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 쿠키 가져오는 유틸리티 함수 (기능 변경 없음)
function getCookie(name: string) {
  const pair = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.split("=").slice(1).join("=")) : "";
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // ✨ 1. 비밀번호 보기/숨기기 상태

  const [csrfName, setCsrfName] = useState("msw_csrf");
  const [csrf, setCsrf] = useState("");
  const [busy, setBusy] = useState(false);
  // ✨ msg state는 이제 alert 팝업으로 대체됩니다.

  // 저장된 이메일 불러오기 (기능 변경 없음)
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  // CSRF 토큰 가져오기 (기능 변경 없음)
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const r = await fetch("/api/csrf", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (ok && j?.cookie) setCsrfName(j.cookie);
      } catch {}
      const c = getCookie(csrfName || "msw_csrf");
      if (ok) {
        if (c) setCsrf(c);
        else setTimeout(() => ok && setCsrf(getCookie(csrfName || "msw_csrf")), 120);
      }
    })();
    return () => { ok = false; };
  }, [csrfName]);

  // 폼 제출 핸들러 (오류 메시지를 alert으로 변경)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    // ✨ 입력값 유효성 검사 (프론트엔드)
    if (!email.trim() || !password.trim()) {
        alert("이메일과 비밀번호를 모두 입력해주세요.");
        setBusy(false);
        return;
    }

    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (csrf) headers["x-csrf-token"] = csrf;

      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json().catch(() => ({}));
      
      // ✨ 로그인 실패 시, 명확한 팝업 알림
      if (!r.ok || !j?.ok) {
        alert("이메일 또는 비밀번호를 확인해주세요.");
        setBusy(false);
        return;
      }
      
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      router.push("/m");
    } catch (err: any) {
      alert("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-blue-50">
      
      <form 
        onSubmit={onSubmit} 
        className="w-full max-w-md space-y-8 rounded-2xl p-10 bg-white shadow-2xl"
      >
        
        {/* ✨ 로고 크기 증대 및 부제 삭제 */}
        <div className="text-center">
            <h1 className="text-6xl font-black text-[#0070f3]">
                MediSwich
            </h1>
        </div>

        <div className="space-y-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
              </div>
              <input
                className="w-full border border-gray-300 rounded-md py-3 pl-10 pr-3 bg-gray-50 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                autoComplete="username"
                required
              />
            </div>

            {/* ✨ 2. 비밀번호 보기/숨기기 기능이 추가된 입력 필드 */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              </div>
              <input
                className="w-full border border-gray-300 rounded-md py-3 pl-10 pr-12 bg-gray-50 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 group"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074L3.707 2.293zM10 12a2 2 0 110-4 2 2 0 010 4z" clipRule="evenodd" /><path d="M10 17a9.95 9.95 0 01-4.522-1.074L4.08 14.478A10.005 10.005 0 01.458 10C1.732 5.943 5.522 3 10 3a9.95 9.95 0 014.522 1.074l1.438 1.438A10.005 10.005 0 0119.542 10c-1.274 4.057-5.064 7-9.542 7z" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                )}
              </button>
            </div>
        </div>
        
        <div className="flex items-center justify-between">
            <div className="flex items-center">
                <input 
                    id="remember-me" 
                    name="remember-me" 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">아이디 저장</label>
            </div>
        </div>

        <button 
          disabled={busy} 
          className="w-full rounded-lg bg-blue-600 text-white py-3 font-bold text-base tracking-wide shadow-md transition-all duration-300 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "로그인 중..." : "로그인"}
        </button>

      </form>
    </main>
  );
}