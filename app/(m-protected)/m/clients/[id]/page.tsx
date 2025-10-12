"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
const card = "bg-white shadow-lg rounded-2xl border border-gray-200";
const sectionHead = "border-b border-gray-100 px-6 py-4 text-base font-semibold text-gray-900";
const body = "px-6 py-6";
const label = "block text-sm font-semibold text-gray-700 mb-2";
const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder:text-gray-400";
const th = "px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left";
const td = "px-4 py-2 text-sm text-gray-700";

type Participant = { name: string; phone: string; supportYn?: "Y" | "N"; supportAmt?: number };
type Detail = {
  id: string;
  name: string;
  contact: string;
  startDate: string;
  endDate: string;
  memo?: string;
  corpCode?: string;
  directUrl?: string;
  createdAt?: string;
  participants: number;
};

const formatPhone = (s: string) => {
  const d = String(s ?? "").replace(/\D/g, "");
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length < 11) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  // participants states
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Participant[]>([]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clients/${id}`, { cache: "no-store" });
    setDetail(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id]);

  const fetchParticipants = useCallback(
    async (p: number) => {
      const res = await fetch(`/api/clients/${id}?view=participants&page=${p}&pageSize=${pageSize}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    fetchParticipants(page);
  }, [page, fetchParticipants]);

  // add modal
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [support, setSupport] = useState(false);
  const [amount, setAmount] = useState(0);

  const submitOne = async () => {
    if (!name.trim() || !phone.trim()) return alert("이름과 전화번호는 필수입니다.");
    const res = await fetch(`/api/clients/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, support, amount }),
    });
    if (!res.ok) return alert("등록 실패");
    setOpen(false); setName(""); setPhone(""); setSupport(false); setAmount(0);
    setPage(1);
    await fetchDetail();
    await fetchParticipants(1);
  };

  // bulk
  const inputRef = useRef<HTMLInputElement>(null);
  const onPickFile = () => inputRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch(`/api/clients/${id}`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((data as any)?.error ?? "업로드 실패");
    } else {
      alert(`총 ${data.received ?? 0}건 중 ${data.inserted ?? 0}건 추가, ${data.skipped ?? 0}건 건너뜀`);
    }
    e.target.value = "";
    setPage(1);
    await fetchDetail();
    await fetchParticipants(1);
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">불러오는 중…</div>;
  }
  if (!detail) {
    return (
      <div className="p-8 text-sm text-gray-500">
        데이터를 찾을 수 없습니다. <button className="underline" onClick={() => router.back()}>뒤로</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          ← 뒤로
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 기본 정보 */}
        <section className={card}>
          <div className={sectionHead}>• 기본 정보</div>
          <div className={body + " space-y-4"}>
            <div>
              <div className={label}>고객사명</div>
              <input className={input} value={detail.name} readOnly />
            </div>
            <div>
              <div className={label}>담당자 연락처</div>
              <input className={input} value={formatPhone(detail.contact)} readOnly />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className={label}>검진기간 시작일</div>
                <input className={input} value={detail.startDate} readOnly />
              </div>
              <div>
                <div className={label}>검진기간 종료일</div>
                <input className={input} value={detail.endDate} readOnly />
              </div>
            </div>
            <div>
              <div className={label}>기업코드</div>
              <input className={input} value={detail.corpCode ?? ""} readOnly />
            </div>
            <div>
              <div className={label}>다이렉트 예약 URL</div>
              <input className={input} value={detail.directUrl ?? ""} readOnly />
            </div>
            <div>
              <div className={label}>메모</div>
              <textarea className={input} value={(detail as any).memo ?? ""} readOnly rows={6} />
            </div>
          </div>
        </section>

        {/* 우측: 대상자 관리 */}
        <section className={card}>
          <div className={sectionHead + " flex items-center justify-between"}>
            <div>• 대상자 관리 총 {total}명</div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:opacity-90">대상자 추가</button>
              <button onClick={onPickFile} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm hover:bg-gray-200">엑셀 일괄등록</button>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
            </div>
          </div>

          <div className={body}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className={th} style={{ width: 220 }}>이름</th>
                    <th className={th} style={{ width: 220 }}>전화번호</th>
                    <th className={th} style={{ width: 120 }}>지원여부</th>
                    <th className={th} style={{ width: 140 }}>지원금</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td className="py-12 text-center text-sm text-gray-400" colSpan={4}>대상자가 없습니다.</td></tr>
                  ) : (
                    items.map((p, i) => (
                      <tr key={`${p.name}-${p.phone}-${i}`} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                        <td className={td}>{p.name}</td>
                        <td className={td}>{formatPhone(p.phone)}</td>
                        <td className={td}>{p.supportYn ?? "N"}</td>
                        <td className={td}>{(p.supportAmt ?? 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">페이지 {page} / {totalPages}</div>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-md text-sm border disabled:opacity-40">이전</button>
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                  const p = i + 1;
                  return <button key={p} onClick={() => setPage(p)} className={clsx("px-3 py-1.5 rounded-md text-sm border", p === page && "bg-gray-900 text-white border-gray-900")}>{p}</button>;
                })}
                {totalPages > 7 && <span className="px-2 text-gray-400">…</span>}
                <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 rounded-md text-sm border disabled:opacity-40">다음</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 추가 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="text-base font-semibold mb-4">대상자 추가</div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">이름</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">전화번호</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} placeholder="010-0000-0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input id="support" type="checkbox" checked={support} onChange={(e) => setSupport(e.target.checked)} className="h-4 w-4" />
                  <label htmlFor="support" className="text-sm">지원여부</label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">지원금(원)</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value || 0))} className={input} placeholder="0" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg text-sm border">취소</button>
              <button onClick={submitOne} className="px-3 py-2 rounded-lg text-sm bg-gray-900 text-white">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

