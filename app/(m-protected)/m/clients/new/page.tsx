// app/(m-protected)/m/clients/new/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/* 공통 스타일 */
const card = "bg-white shadow-lg rounded-2xl border border-gray-200";
const sectionHead = "border-b border-gray-100 px-6 py-4 text-base font-semibold text-gray-900";
const body = "px-6 py-6";
const label = "block text-sm font-semibold text-gray-700 mb-2";
const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder:text-gray-400";
const btnBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors";
const btn = {
  primary: clsx(btnBase, "bg-sky-600 hover:bg-sky-700 text-white shadow-sm"),
  ghost: clsx(btnBase, "bg-white hover:bg-gray-50 border border-gray-300 text-gray-700"),
};
const th = "px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left";
const td = "px-4 py-2 text-sm text-gray-700";

/* 타입 */
type Participant = { name: string; phone: string; supportYn?: "Y" | "N"; supportAmt?: number };
type ClientRow = {
  id: string;
  name: string;
  contact: string;
  startDate: string;
  endDate: string;
  participants: number;
  corpCode?: string | null;
  directUrl?: string | null;
  createdAt?: string | Date | null;
};
type SavePayload = {
  name: string;
  contact: string;
  startDate: string;
  endDate: string;
  memo?: string;
  corpCode?: string;
  directUrl?: string;
  participants?: Participant[];
};
type HospitalInfo = { id: string; name: string; slug: string };

/* 유틸 */
function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length < 11) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}
function safeOrigin() {
  if (typeof window === "undefined") return "";
  try {
    return window.location.origin || "";
  } catch {
    return "";
  }
}
function buildDirectUrlWith(h: HospitalInfo | null, code: string) {
  const c = (code || "").trim().toUpperCase();
  if (!h || !c) return "";
  const origin = safeOrigin();
  // 예약자 공개 규격: /r/{tenantSlug}?code={CODE}
  return `${origin}/r/${h.slug}?code=${encodeURIComponent(c)}`;
}
function isValidDatePair(a: string, b: string) {
  if (!a || !b) return false;
  const s = new Date(a);
  const e = new Date(b);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
  return s.getTime() <= e.getTime();
}

export default function Page() {
  const router = useRouter();

  /* 병원 정보 */
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  useEffect(() => {
    fetch("/api/m/org/self")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.hospital) setHospital(j.hospital as HospitalInfo);
      })
      .catch(() => {});
  }, []);

  /* 폼 상태 */
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [corpCode, setCorpCode] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [memo, setMemo] = useState("");

  /* 기업코드 검증 상태 */
  const [verifying, setVerifying] = useState(false);
  const [verifyOk, setVerifyOk] = useState<boolean | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string>("");

  /* 업로드/미리보기 */
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  /* 목록 */
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [q, setQ] = useState("");
  const [isSaving, startSaving] = useTransition();

  /* 다이렉트 URL 자동 생성 (병원/코드 변경 시) */
  useEffect(() => {
    setDirectUrl(buildDirectUrlWith(hospital, corpCode));
  }, [corpCode, hospital]);

  /* 목록 불러오기 – API만 사용 */
  const loadRows = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) throw new Error("failed to load clients");
      const data: ClientRow[] = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.name?.includes(t) ||
        r.contact?.includes(t) ||
        (r.corpCode ?? "").includes(t) ||
        (r.directUrl ?? "").includes(t)
    );
  }, [q, rows]);

  /* 엑셀/CSV 파서 */
  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop() || "";
    const buf = await file.arrayBuffer();
    let next: Participant[] = [];

    if (ext === "xlsx" || ext === "xls") {
      const XLSX = (await import("xlsx")).default;
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      next = json.map((r) => ({
        name: String(r["이름"] ?? r["성명"] ?? "").trim(),
        phone: formatPhone(String(r["전화번호"] ?? "").trim()),
        supportYn: String(r["지원여부"] ?? "").trim() === "Y" ? "Y" : "N",
        supportAmt: Number(r["지원금"] ?? 0) || 0,
      }));
    } else {
      const text = new TextDecoder().decode(buf);
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length) {
        const header = lines[0].split(",").map((h) => h.trim());
        const idx = {
          name: header.findIndex((h) => /이름|성명/.test(h)),
          phone: header.findIndex((h) => /전화/.test(h)),
          yn: header.findIndex((h) => /지원.?여부/.test(h)),
          amt: header.findIndex((h) => /지원.?금/.test(h)),
        };
        next = lines.slice(1).map((line) => {
          const c = line.split(",");
          return {
            name: (c[idx.name] ?? "").trim(),
            phone: formatPhone((c[idx.phone] ?? "").trim()),
            supportYn: ((c[idx.yn] ?? "").trim() === "Y" ? "Y" : "N") as "Y" | "N",
            supportAmt: Number(c[idx.amt] ?? 0) || 0,
          };
        });
      }
    }

    next = next.filter((p) => p.name || p.phone);
    setParticipants(next);
    setTotalCount(next.length);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) await handleFile(f);
  }, [handleFile]);

  const preview10 = useMemo(() => participants.slice(0, 10), [participants]);

  /* 기업코드 검증 */
  const verifyCode = useCallback(async () => {
    if (!hospital) {
      setVerifyOk(false);
      setVerifyMsg("병원 정보를 불러오는 중입니다. 잠시 후 다시 시도하세요.");
      return;
    }
    const c = corpCode.trim().toUpperCase();
    if (!c) {
      setVerifyOk(false);
      setVerifyMsg("코드를 입력하세요.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`/api/public/${hospital.slug}/company/verify?code=${encodeURIComponent(c)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setVerifyOk(true);
        setVerifyMsg(`${j.company?.name ?? "등록된 기업"} 코드 확인 완료`);
      } else {
        setVerifyOk(false);
        setVerifyMsg("유효하지 않은 코드입니다.");
      }
    } catch {
      setVerifyOk(false);
      setVerifyMsg("검증 중 오류가 발생했습니다.");
    } finally {
      setVerifying(false);
    }
  }, [hospital, corpCode]);

  /* 저장 – API 성공 필수 */
  const onSave = useCallback(async () => {
    if (!name.trim()) return alert("고객사명을 입력하세요.");
    if (!startDate || !endDate) return alert("검진기간을 입력하세요.");
    if (!isValidDatePair(startDate, endDate)) return alert("검진기간의 시작/종료 날짜를 확인하세요.");

    const codeNorm = corpCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const urlNorm = buildDirectUrlWith(hospital, codeNorm);

    const payload: SavePayload = {
      name: name.trim(),
      contact: contact.trim(),
      startDate,
      endDate,
      memo,
      corpCode: codeNorm,
      directUrl: urlNorm,
      participants,
    };

    startSaving(async () => {
      try {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const { message } = await res.json().catch(() => ({ message: "" }));
          alert(message || "저장에 실패했습니다.");
          return;
        }
        alert("저장되었습니다.");
        setName(""); setContact(""); setStartDate(""); setEndDate("");
        setMemo(""); setCorpCode(""); setParticipants([]); setTotalCount(0);
        setVerifyOk(null); setVerifyMsg("");
        await loadRows();
      } catch {
        alert("네트워크 오류로 저장에 실패했습니다.");
      }
    });
  }, [name, contact, startDate, endDate, memo, corpCode, hospital, participants, loadRows, startSaving]);

  // 클립보드 복사 피드백
  const [copied, setCopied] = useState(false);
  const copyUrl = useCallback(async () => {
    try {
      if (!directUrl) return;
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        // 대체 복사
        const ta = document.createElement("textarea");
        ta.value = directUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } else {
        await navigator.clipboard.writeText(directUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }, [directUrl]);

  return (
    <div className="px-6 pb-24 pt-4">
      <div className="mb-4 flex justify-end gap-2">
        <a href="/api/clients/template" className={btn.ghost}>템플릿 다운로드</a>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 좌 카드 */}
        <section className={card}>
          <div className={sectionHead}>• 기본 정보</div>
          <div className={body + " space-y-6"}>
            <div>
              <label className={label}>고객사명 *</label>
              <input className={input} placeholder="예) (주)메디스위치" value={name}
                     onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label className={label}>담당자 연락처</label>
              <input className={input} placeholder="010-0000-0000" value={contact}
                     onChange={(e) => setContact(formatPhone(e.target.value))} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={label}>검진기간 시작일</label>
                <input type="date" className={input} value={startDate}
                       onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className={label}>검진기간 종료일</label>
                <input type="date" className={input} value={endDate}
                       onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className={label}>기업코드</label>
              <div className="flex items-center gap-2">
                <input
                  className={input}
                  placeholder="예) MEDI2025"
                  value={corpCode}
                  onChange={(e) => setCorpCode(e.target.value.toUpperCase())}
                />
                <button className={btn.ghost} onClick={verifyCode} disabled={verifying}>
                  {verifying ? "확인 중..." : "코드 확인"}
                </button>
              </div>
              {verifyOk !== null && (
                <p className={clsx("mt-2 text-sm", verifyOk ? "text-emerald-600" : "text-red-600")}>
                  {verifyMsg}
                </p>
              )}
            </div>

            <div>
              <label className={label}>
                다이렉트 예약 URL
                {hospital && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {hospital.name}
                  </span>
                )}
              </label>
              <div className="flex gap-2 items-center">
                <input className={input} readOnly placeholder="자동 생성됩니다" value={directUrl} />
                <button className={clsx(btn.ghost, "px-3")} onClick={copyUrl}>
                  {copied ? "복사됨" : "복사"}
                </button>
                {directUrl && (
                  <a className={clsx(btn.ghost, "px-3")} href={directUrl} target="_blank" rel="noreferrer">
                    열기
                  </a>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                규격: <code className="font-mono bg-gray-50 px-1 rounded">/r/{`{병원슬러그}`}?code={`{기업코드}`}</code>
              </p>
            </div>

            <div>
              <label className={label}>메모</label>
              <textarea rows={6} className={input}
                        placeholder="특이사항, 계약/정산 메모 등"
                        value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
        </section>

        {/* 우 카드 */}
        <section className={card}>
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="text-base font-semibold text-gray-900">• 대상자 업로드 (CSV / XLSX)</div>
            <div>
              <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden"
                     onChange={async (e) => {
                       const f = e.target.files?.[0];
                       if (f) await handleFile(f);
                       if (fileRef.current) fileRef.current.value = "";
                     }}/>
              <button className={btn.ghost} onClick={() => fileRef.current?.click()}>파일 선택</button>
            </div>
          </div>

          <div className={body}>
            <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
                 className="mb-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-gray-600">
              CSV 또는 엑셀(.xlsx/.xls) 파일을 드래그 앤 드롭하거나, 우측의 [파일 선택]을 클릭하세요.
            </div>

            <div className="mb-3 flex items-end justify-between">
              <div className="text-sm font-semibold text-gray-800">
                미리보기 · <span className="text-sky-600">총 {totalCount}명</span>
              </div>
              {!!participants.length && (
                <div className="text-xs text-gray-500">최대 10명까지만 미리봅니다.</div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={th} style={{ width: 160 }}>이름</th>
                    <th className={th} style={{ width: 220 }}>전화번호</th>
                    <th className={th} style={{ width: 120 }}>지원여부</th>
                    <th className={th} style={{ width: 140 }}>지원금</th>
                  </tr>
                </thead>
                <tbody>
                {preview10.length === 0 ? (
                  <tr><td className="py-12 text-center text-sm text-gray-400" colSpan={4}>미리볼 데이터가 없습니다.</td></tr>
                ) : (
                  preview10.map((p, i) => (
                    <tr key={`${p.name}-${i}`} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className={td}>{p.name}</td>
                      <td className={td}>{p.phone}</td>
                      <td className={td}>{p.supportYn ?? "N"}</td>
                      <td className={td}>{(p.supportAmt ?? 0).toLocaleString()}</td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* 저장/취소 */}
      <div className="mt-6 flex items-center justify-end gap-2">
        <button className={btn.ghost} onClick={() => router.back()}>취소</button>
        <button className={clsx(btn.primary, (isSaving ? "opacity-60 cursor-not-allowed" : ""))} onClick={onSave} disabled={isSaving}>
          {isSaving ? "저장 중…" : "저장"}
        </button>
      </div>

      {/* 등록된 고객사 */}
      <section className={clsx(card, "mt-10")}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            • 등록된 고객사 <span className="text-sky-600">총 {rows.length}건</span>
          </h2>
          <input
            className={clsx(input, "w-80 sm:w-96")}
            placeholder="검색: 고객사명 / 연락처 / 코드 / URL"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className={th} style={{ width: 220 }}>고객사명</th>
                <th className={th} style={{ width: 160 }}>연락처</th>
                <th className={th} style={{ width: 260 }}>검진기간</th>
                <th className={th} style={{ width: 90 }}>대상자 수</th>
                <th className={th} style={{ width: 140 }}>기업코드</th>
                <th className={th}>다이렉트 URL</th>
                <th className={th} style={{ width: 120 }}>등록일</th>
              </tr>
            </thead>
            <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">조회 결과가 없습니다.</td>
              </tr>
            ) : filtered.map((r, i) => (
              <tr key={r.id}
                  title="클릭하면 상세 보기로 이동합니다"
                  onClick={() => r.id && router.push(`/m/clients/${r.id}`)}
                  className={clsx(i % 2 ? "bg-white" : "bg-gray-50/50", "hover:bg-sky-50 cursor-pointer")}>
                <td className={td}>{r.name}</td>
                <td className={td}>{r.contact}</td>
                <td className={td}>{r.startDate} ~ {r.endDate}</td>
                <td className={td}>{(r.participants ?? 0).toLocaleString()}명</td>
                <td className={td}>{r.corpCode ?? "-"}</td>
                <td className={td}>
                  {r.directUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="truncate">{r.directUrl}</span>
                      <button
                        className="text-sky-600 hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText?.(r.directUrl!); }}>
                        복사
                      </button>
                    </div>
                  ) : "-"}
                </td>
                <td className={td}>
                  {r.createdAt ? new Date(r.createdAt as any).toLocaleDateString("ko-KR") : "-"}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

