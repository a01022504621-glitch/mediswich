"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { tryFetchJSON } from "@/lib/clientStore";

type Row = { name: string; phone: string; dept: string; status: string };
type LoadRes = {
  client: { id: string; name: string; directUrl: string; endDate: string };
  total: number;
  items: Row[];
};

function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
const card = "bg-white shadow-lg rounded-2xl border border-gray-200";
const sectionHead = "border-b border-gray-100 px-6 py-4 text-base font-semibold text-gray-900";
const body = "px-6 py-6";
const th = "py-2 pr-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide";
const td = "py-2 pr-4 text-sm text-gray-800";

function formatPhone(v: string) {
  const d = (v || "").replace(/\D/g, "");
  if (d.startsWith("02")) return d.replace(/(02)(\d{3,4})(\d{4})/, "$1-$2-$3");
  return d.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3");
}

export default function UnreservedPage({ params }: { params: { id: string } }) {
  const clientId = params.id;
  const [kw, setKw] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadRes | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = kw.trim() ? `?q=${encodeURIComponent(kw.trim())}` : "";
    const res = await tryFetchJSON<LoadRes>(`/api/clients/${clientId}/unreserved${q}`);
    setData(res ?? { client: { id: clientId, name: "", directUrl: "", endDate: "" }, total: 0, items: [] });
    setLoading(false);
  }, [clientId, kw]);

  useEffect(() => { load(); }, [load]);

  // selection
  const [sel, setSel] = useState<Record<string, boolean>>({});
  useEffect(() => { setSel({}); }, [clientId, data?.items]);

  const items = data?.items ?? [];
  const allChecked = useMemo(() => items.length > 0 && items.every((r) => sel[r.phone]), [items, sel]);
  const someChecked = useMemo(() => items.some((r) => sel[r.phone]), [items, sel]);
  const selected = useMemo(() => items.filter((r) => sel[r.phone]), [items, sel]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) items.forEach((r) => (next[r.phone] = true));
    setSel(next);
  };

  // message compose
  const nowClient = data?.client?.name ?? "";
  const deadline = data?.client?.endDate ?? "";
  const url = data?.client?.directUrl || "";
  const [msg, setMsg] = useState("{name}님, {client} 검진 예약이 아직 완료되지 않았습니다.\n아래 링크에서 빠르게 예약해 주세요: {url}\n(마감: {deadline})");
  useEffect(() => {
    // 템플릿 초기치에 실제 값 프리뷰 반영은 전송 시에 대체함
  }, [nowClient, url, deadline]);

  const [sending, setSending] = useState(false);
  const send = async () => {
    if (selected.length === 0) return alert("대상을 선택하세요.");
    setSending(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "ALIMTALK",
          template: msg,
          items: selected.map((r) => ({ name: r.name, phone: r.phone })),
          variables: { client: nowClient, url, deadline },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error("fail");
      alert(`알림톡 ${data.count}건 발송 완료`);
      setSel({});
    } catch {
      alert("발송 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-sky-600">미예약자</span> 확인 · 알림톡 발송
        </h1>
        <Link href="/m/clients/status" className="text-sm text-gray-600 hover:text-gray-900">← 현황으로</Link>
      </div>

      {/* 필터 & 요약 */}
      <section className={card}>
        <div className={sectionHead}>필터 / 요약</div>
        <div className={body + " grid grid-cols-1 md:grid-cols-5 gap-4 items-center"}>
          <div className="md:col-span-3">
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="이름/전화/부서 검색"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
          </div>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">검색</button>
          <div className="text-sm text-gray-600">
            대상: <b className="tabular-nums">{data?.total ?? 0}</b>명
          </div>
        </div>
      </section>

      {/* 목록 + 선택 + 발송 */}
      <section className={card}>
        <div className={sectionHead + " flex items-center justify-between"}>
          <div>미예약자 목록</div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              전체 선택
            </label>
            <button
              onClick={send}
              disabled={!someChecked || sending}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm",
                !someChecked || sending ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white"
              )}
            >
              알림톡 보내기 {someChecked ? `(${selected.length}명)` : ""}
            </button>
          </div>
        </div>

        <div className={body + " space-y-4"}>
          {/* 템플릿 편집 */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">메시지 템플릿</div>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">
              사용 가능 변수: <code>{`{name}`}</code>, <code>{`{client}`}</code>, <code>{`{url}`}</code>, <code>{`{deadline}`}</code>
            </div>
          </div>

          {/* 목록 테이블 */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className={th} style={{ width: 48 }}></th>
                  <th className={th}>이름</th>
                  <th className={th}>전화번호</th>
                  <th className={th}>부서</th>
                  <th className={th}>상태</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-400">불러오는 중…</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-400">대상이 없습니다.</td></tr>
                )}
                {!loading && items.map((r) => (
                  <tr key={r.phone} className="border-b last:border-0">
                    <td className={td}>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!sel[r.phone]}
                        onChange={(e) => setSel((s) => ({ ...s, [r.phone]: e.target.checked }))}
                      />
                    </td>
                    <td className={td}>{r.name}</td>
                    <td className={td}>{formatPhone(r.phone)}</td>
                    <td className={td}>{r.dept || "-"}</td>
                    <td className={td}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 미리보기 */}
          {selected.length > 0 && (
            <div className="text-xs text-gray-600">
              <div className="font-semibold mb-1">미리보기 (첫 1명):</div>
              <pre className="bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                {msg
                  .replace(/{name}/g, selected[0]?.name || "")
                  .replace(/{client}/g, nowClient)
                  .replace(/{url}/g, url)
                  .replace(/{deadline}/g, deadline)}
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

