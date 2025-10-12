"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Client = { id: string; name: string; contact?: string; memo?: string; employees?: any[]; createdAt: string };

export default function ClientsList() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/clients", { cache: "no-store" });
      const j = await r.json();
      setItems(Array.isArray(j?.items) ? j.items : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">고객사 관리</h1>
        <div className="flex items-center gap-2">
          <a href="/api/clients/template" className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50">CSV 템플릿</a>
          <Link href="/m/clients/new" className="rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-4 py-2 text-sm shadow-sm hover:brightness-110">
            새 고객사
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">고객사명</th>
              <th className="px-3 py-2 text-left">담당자 연락처</th>
              <th className="px-3 py-2 text-right">대상자 수</th>
              <th className="px-3 py-2 text-left">메모</th>
              <th className="px-3 py-2 text-left">등록일</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">불러오는 중…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">등록된 고객사가 없습니다.</td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">{c.contact ?? "-"}</td>
                <td className="px-3 py-2 text-right">{c.employees?.length ?? 0}</td>
                <td className="px-3 py-2 text-slate-600">{c.memo ?? "-"}</td>
                <td className="px-3 py-2 text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
