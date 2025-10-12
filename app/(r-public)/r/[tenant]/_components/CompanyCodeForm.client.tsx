// app/(r-public)/r/[tenant]/_components/CompanyCodeForm.client.tsx
"use client";

import { useState } from "react";
// 현재 개발 환경에서는 오류가 발생하지만, 고객님의 Next.js 환경을 위해 원래대로 유지합니다.
import { useParams, useRouter } from "next/navigation"; 

export default function CompanyCodeForm({ tenant }: { tenant?: string }) {
  const { tenant: routeTenant } = useParams<{ tenant: string }>();
  const t = tenant ?? routeTenant;

  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setErr("기업코드를 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/public/${t}/company/verify?code=${encodeURIComponent(trimmed)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!r.ok) {
        setErr("조회된 패키지가 없습니다. 기업코드를 다시 확인해주세요.");
        return;
      }
      router.push(`/r/${t}?cat=corp&code=${encodeURIComponent(trimmed)}`);
    } catch {
      setErr("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md p-6 bg-white rounded-xl shadow-2xl space-y-5">
      <div className="space-y-1">
        <label htmlFor="company-code" className="block text-sm font-bold text-gray-800">
          기업 코드 입력
        </label>
        <p className="text-xs text-gray-500">
          기업으로부터 제공받은 코드를 정확히 입력해 주세요.
        </p>
      </div>
      
      <input
        id="company-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-sm"
        placeholder="예) ABC123"
        autoComplete="off"
        aria-label="기업 코드"
      />

      {err && (
        <div className="bg-red-50 p-3 rounded-lg border border-red-200" role="alert">
          <p className="text-sm text-red-600 font-medium">{err}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-blue-600 text-white px-4 py-2.5 text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
      >
        {busy ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            확인 중...
          </span>
        ) : "확인"}
      </button>

      <p className="text-xs text-center text-gray-500 mt-4">
        기업 전용 상품이 있을 경우에만 전용 목록이 노출됩니다.
      </p>
    </form>
  );
}


