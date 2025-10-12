"use client";
import { useState } from "react";

export default function ChangePasswordPage() {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    const r = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(j?.ok ? "변경되었습니다. 좌측 메뉴로 이동해 주세요." : (j?.error || "변경 실패"));
  };

  return (
    <div className="max-w-sm p-4 space-y-3">
      <h1 className="text-lg font-semibold">비밀번호 변경</h1>
      <input className="w-full border rounded px-2 py-1" placeholder="현재 비밀번호"
             type="password" value={cur} onChange={(e)=>setCur(e.target.value)} />
      <input className="w-full border rounded px-2 py-1" placeholder="새 비밀번호(8자 이상)"
             type="password" value={nw} onChange={(e)=>setNw(e.target.value)} />
      <button onClick={submit} className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm">
        변경
      </button>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </div>
  );
}


