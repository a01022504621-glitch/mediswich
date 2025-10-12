"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = { name: string; phone?: string; support?: string; subsidy?: number };

const slug = (s: string) =>
  s.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^\w가-힣-]/g, "_").toLowerCase().slice(0, 40);

export default function NewClient() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [memo, setMemo] = useState("");

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapIdx, setMapIdx] = useState<{ name?: number; phone?: number; support?: number; subsidy?: number }>({});

  const fileInput = useRef<HTMLInputElement | null>(null);

  const parseCSV = (text: string) => {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
    const parsed = lines.map((line) => {
      const out: string[] = []; let cur = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (q && line[i+1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === "," && !q) { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    });
    if (!parsed.length) return;
    setHeaders(parsed[0]);
    setRows(parsed.slice(1));

    const H = parsed[0].map((h) => h.replace(/\s/g, ""));
    const find = (kws: string[]) => H.findIndex((h) => kws.some((k) => h.includes(k)));
    setMapIdx({
      name: find(["이름","성명","name"]),
      phone: find(["전화","휴대","연락","phone"]),
      support: find(["지원유무","지원","대상"]),
      subsidy: find(["지원금","금액","비용"]),
    });
  };

  const onPickFile = async (f: File) => {
    setFileName(f.name);
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") { alert("엑셀은 CSV로 저장해 업로드해 주세요(.csv)"); return; }
    const text = await f.text();
    parseCSV(text);
  };

  const mappedEmployees: Employee[] = useMemo(() => {
    if (rows.length === 0) return [];
    const out: Employee[] = [];
    for (const r of rows) {
      const e: Employee = {
        name: mapIdx.name != null ? r[mapIdx.name] : "",
        phone: mapIdx.phone != null ? r[mapIdx.phone] : undefined,
        support: mapIdx.support != null ? r[mapIdx.support] : undefined,
        subsidy: mapIdx.subsidy != null ? Number(r[mapIdx.subsidy] ?? "") || 0 : undefined,
      };
      if (e.name) out.push(e);
    }
    return out;
  }, [rows, mapIdx]);

  const save = async () => {
    if (!name.trim()) { alert("고객사명을 입력하세요."); return; }
    const body = {
      id: slug(name),
      name: name.trim(),
      contact: contact.trim() || undefined,
      memo: memo.trim() || undefined,
      employees: mappedEmployees,
    };
    const r = await fetch("/api/clients", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) { alert("저장 실패"); return; }
    router.replace("/m/clients");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">새 고객사 등록</h1>
        <div className="flex items-center gap-2">
          <a href="/api/clients/template" className="rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50">CSV 템플릿</a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌: 기본정보 */}
        <div className="space-y-4 rounded-2xl border p-4">
          <h2 className="font-semibold">기본 정보</h2>
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">고객사명 *</div>
            <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">담당자 연락처</div>
            <input value={contact} onChange={(e)=>setContact(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">메모</div>
            <textarea value={memo} onChange={(e)=>setMemo(e.target.value)} rows={4} className="w-full rounded-lg border px-3 py-2" />
          </label>
        </div>

        {/* 우: 대상자 업로드/미리보기 */}
        <div className="space-y-4 rounded-2xl border p-4">
          <h2 className="font-semibold">대상자 업로드 (CSV)</h2>

          <div
            onDragOver={(e)=>e.preventDefault()}
            onDrop={(e)=>{ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) onPickFile(f); }}
            className="rounded-2xl border-2 border-dashed px-4 py-10 text-center text-slate-600"
          >
            <p className="mb-2">CSV 파일을 드래그 앤 드롭하거나</p>
            <button onClick={()=>fileInput.current?.click()} className="rounded-full border px-4 py-2 text-sm hover:bg-slate-50">파일 선택</button>
            <input ref={fileInput} type="file" accept=".csv" hidden onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onPickFile(f); }} />
            {fileName && <p className="mt-3 text-sm text-slate-500">{fileName}</p>}
          </div>

          {headers.length>0 && (
            <>
              {/* 컬럼 매핑 */}
              <div className="rounded-xl border p-3">
                <div className="text-sm mb-2 text-slate-700">컬럼 매핑</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MapSelect label="이름"     headers={headers} value={mapIdx.name}    onChange={(v)=>setMapIdx({...mapIdx, name:v})}/>
                  <MapSelect label="전화번호" headers={headers} value={mapIdx.phone}   onChange={(v)=>setMapIdx({...mapIdx, phone:v})}/>
                  <MapSelect label="지원유무" headers={headers} value={mapIdx.support} onChange={(v)=>setMapIdx({...mapIdx, support:v})}/>
                  <MapSelect label="지원금"   headers={headers} value={mapIdx.subsidy} onChange={(v)=>setMapIdx({...mapIdx, subsidy:v})}/>
                </div>
              </div>

              {/* 미리보기 */}
              <div className="rounded-2xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">이름</th>
                      <th className="px-3 py-2 text-left">전화번호</th>
                      <th className="px-3 py-2 text-left">지원유무</th>
                      <th className="px-3 py-2 text-right">지원금</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedEmployees.slice(0,50).map((e,i)=>(
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{e.name}</td>
                        <td className="px-3 py-1.5">{e.phone ?? "-"}</td>
                        <td className="px-3 py-1.5">{e.support ?? "-"}</td>
                        <td className="px-3 py-1.5 text-right">{e.subsidy ?? 0}</td>
                      </tr>
                    ))}
                    {mappedEmployees.length===0 && (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">유효한 데이터가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
                {mappedEmployees.length>50 && (
                  <div className="px-3 py-2 text-xs text-slate-500">미리보기는 50행까지만 표시합니다.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={()=>router.back()} className="rounded-lg border px-4 py-2 hover:bg-slate-50">취소</button>
        <button onClick={save} className="rounded-lg bg-emerald-600 text-white px-4 py-2">저장</button>
      </div>
    </div>
  );
}

function MapSelect({
  label, headers, value, onChange,
}: { label: string; headers: string[]; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-600 mb-1">{label}</div>
      <select
        value={value ?? ""}
        onChange={(e)=>onChange(e.target.value===""?undefined:Number(e.target.value))}
        className="w-full rounded-lg border px-2 py-2"
      >
        <option value="">(선택 안 함)</option>
        {headers.map((h, idx)=>(<option key={idx} value={idx}>{h || `컬럼 ${idx+1}`}</option>))}
      </select>
    </label>
  );
}

