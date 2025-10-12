// app/(m-protected)/m/vaccines/reservations/_components/List.tsx
"use client";

import useSWR from "swr";
import { Syringe, X, Clock, ClipboardList } from "lucide-react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function List() {
  const { data, isLoading, mutate } = useSWR(
    "/api/vaccines/reservations?date=today",
    fetcher,
    { refreshInterval: 5000 }
  );

  if (isLoading) return <div className="p-10 text-slate-500">목록 불러오는 중…</div>;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="grid grid-cols-[90px_1fr_160px_110px_120px_1fr_220px] gap-0 border-b bg-slate-50 px-4 py-2 text-xs text-slate-500">
        <div>시간</div><div>이름/연락처</div><div>백신(회차)</div><div>상태</div><div>부스/담당</div><div>로트/만료</div><div>액션</div>
      </div>

      {data?.items?.map((r: any) => (
        <div key={r.id} className="grid grid-cols-[90px_1fr_160px_110px_120px_1fr_220px] gap-0 px-4 py-2 border-b hover:bg-slate-50">
          <div className="tabular-nums text-slate-700">{r.time}</div>
          <div className="truncate">{r.name} <span className="text-slate-400">{r.phone}</span></div>
          <div>{r.vaccine} <span className="text-slate-400">{r.doseNo === 1 ? "1차" : r.doseNo === 2 ? "2차" : "부스터"}</span></div>
          <div><StatusChip status={r.status} /></div>
          <div>{r.booth ?? "-"} / {r.staff ?? "-"}</div>
          <div className="truncate">{r.lotNo ?? "-"} <span className="text-slate-400">{r.expDate ?? ""}</span></div>
          <div className="flex gap-2">
            <Btn onClick={() => act(`/api/vaccines/reservations/${r.id}/checkin`, mutate)} icon={Clock} text="체크인" />
            <Btn onClick={() => act(`/api/vaccines/reservations/${r.id}/complete`, mutate)} icon={Syringe} text="완료" />
            <Btn onClick={() => act(`/api/vaccines/reservations/${r.id}/cancel`, mutate)} icon={X} text="취소" />
            <Btn onClick={() => openDrawer(r)} icon={ClipboardList} text="상세" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-slate-100 text-slate-700",
    checked_in: "bg-blue-100 text-blue-700",
    prepped: "bg-amber-100 text-amber-700",
    in_progress: "bg-violet-100 text-violet-700",
    done: "bg-emerald-100 text-emerald-700",
    no_show: "bg-rose-100 text-rose-700",
    cancelled: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.scheduled}`}>
      {status}
    </span>
  );
}

function Btn({ onClick, icon: Icon, text }: any) {
  return (
    <button onClick={onClick} className="rounded-lg border px-2.5 py-1 text-xs hover:bg-slate-50">
      <Icon className="inline h-4 w-4 mr-1" strokeWidth={1.8} />{text}
    </button>
  );
}

async function act(url: string, mutate: any) {
  await fetch(url, { method: "POST" });
  mutate();
}

function openDrawer(r: any) {
  // 오른쪽 상세 드로어 열기(네 프로젝트 Drawer 컴포넌트 연동 지점)
  console.log("open detail", r.id);
}

