// app/(m-public)/m/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getCookie(name: string) {
  const pair = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.split("=").slice(1).join("=")) : "";
}

export default function LoginPage() {
  const router = useRouter();

  const [tenant, setTenant] = useState("");     // 예: gogohospital / hihospital
  const [email, setEmail] = useState("");       // 예: gogo@admin.co.kr
  const [password, setPassword] = useState(""); // 예: admin1234!

  const [csrfName, setCsrfName] = useState("msw_csrf");
  const [csrf, setCsrf] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
    return () => {
      ok = false;
    };
  }, [csrfName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (csrf) headers["x-csrf-token"] = csrf; // 서버가 읽는 헤더명

      const payload: any = { email, password };
      if (tenant.trim()) payload.tenant = tenant.trim();

      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setMsg(j?.message || `Login failed (${r.status})`);
        setBusy(false);
        return;
      }
      router.push("/m"); // 성공 후 이동
    } catch (err: any) {
      setMsg(err?.message || "Network error");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-xl p-6 shadow-sm bg-white">
        <h1 className="text-xl font-semibold">Mediswitch 로그인</h1>

        <div className="space-y-2">
          <label className="text-sm">병원 슬러그(선택)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            placeholder="예: gogohospital 또는 hihospital"
          />
          <p className="text-[11px] text-gray-500">미입력 시 첫 병원으로 로그인됩니다.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm">이메일</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="예: gogo@admin.co.kr"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">비밀번호</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            autoComplete="current-password"
          />
        </div>

        <button disabled={busy} className="w-full rounded bg-black text-white py-2 disabled:opacity-60">
          {busy ? "로그인 중..." : "로그인"}
        </button>

        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <p className="text-xs text-gray-500">CSRF: {csrf ? "확보됨" : "확보 중..."}</p>
      </form>
    </main>
  );
}

