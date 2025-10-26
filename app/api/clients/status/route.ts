export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/clients/status/route.ts
// 고객사 검진 현황 집계 API (인메모리 store 기준)
// 기존에 /api/clients/[id]/route.ts 에서 쓰던 __MEM_CLIENTS__ 를 그대로 활용합니다.

type Participant = {
  name: string;
  phone: string;
  dept?: string;
  site?: string;
  supportYn?: "Y" | "N";
  supportAmt?: number;
  // 선택적으로 존재할 수 있는 예약 상태
  status?: "REGISTERED" | "INVITED" | "RESERVED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  bookingStatus?: "REGISTERED" | "INVITED" | "RESERVED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
};

type ClientDetail = {
  id: string;
  name: string;
  contact: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  corpCode?: string;
  directUrl?: string;
  memo?: string;
  createdAt?: string;
  participants: number;
  participantsList: Participant[];
};

type Item = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  dDay: number;              // 종료일까지 남은 일수 (음수면 지남)
  registered: number;        // 등록
  reserved: number;          // 예약
  completed: number;         // 완료
  noShow: number;            // 노쇼
  cancelled: number;         // 취소
  remaining: number;         // 남은 인원(등록 - 완료 - 취소)
  supportSpent: number;      // 지원금 합계(가용 데이터 기준)
};

type ResponseBody = {
  period: { start?: string; end?: string };
  totals: {
    registered: number;
    reserved: number;
    completed: number;
    noShow: number;
    cancelled: number;
    remaining: number;
  };
  items: Item[];
};

// ───────────────────────────────────────────────────────────────
function getStore() {
  const g = globalThis as any;
  if (!g.__MEM_CLIENTS__) g.__MEM_CLIENTS__ = { list: [], map: new Map<string, ClientDetail>() };
  return g.__MEM_CLIENTS__ as { list: any[]; map: Map<string, ClientDetail> };
}

function pickStatus(p: Participant): string {
  return (p.status || p.bookingStatus || "REGISTERED").toUpperCase();
}

function toDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function daysLeft(endDate: string) {
  const end = toDate(endDate);
  const today = new Date();
  // 00:00 기준 비교
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff; // 음수면 종료 지남
}

// ───────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (s: string) => (url.searchParams.get(s) || "").trim().toLowerCase();
  const kw = q("q"); // 고객사명 검색
  const onlyUrgent = url.searchParams.get("urgent") === "1"; // 마감 임박(D<=7) 필터
  const periodStart = url.searchParams.get("start") || undefined;
  const periodEnd = url.searchParams.get("end") || undefined;

  const { map } = getStore();
  const items: Item[] = [];

  for (const [, c] of map) {
    if (kw && !c.name.toLowerCase().includes(kw)) continue;

    // 기간 필터(선택)
    if (periodStart && c.endDate < periodStart) continue;
    if (periodEnd && c.startDate > periodEnd) continue;

    const arr = Array.isArray(c.participantsList) ? c.participantsList : [];
    let reg = arr.length;
    let reserved = 0, completed = 0, noShow = 0, cancelled = 0;

    for (const p of arr) {
      const st = pickStatus(p);
      if (st === "RESERVED" || st === "INVITED") reserved++;
      if (st === "COMPLETED") completed++;
      if (st === "NO_SHOW") noShow++;
      if (st === "CANCELLED") cancelled++;
    }

    const remain = Math.max(0, reg - completed - cancelled);
    const supportSum = arr.reduce((sum, p) => sum + (Number(p.supportAmt || 0) || 0), 0);
    const dDay = daysLeft(c.endDate);

    const it: Item = {
      id: c.id,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      dDay,
      registered: reg,
      reserved,
      completed,
      noShow,
      cancelled,
      remaining: remain,
      supportSpent: supportSum,
    };

    if (onlyUrgent && dDay > 7) continue;
    items.push(it);
  }

  // 정렬: 마감 임박 우선 → 완료율 낮은 순
  items.sort((a, b) => {
    const aUrg = a.dDay <= 7 ? 1 : 0;
    const bUrg = b.dDay <= 7 ? 1 : 0;
    if (aUrg !== bUrg) return bUrg - aUrg;
    const ar = a.registered ? a.completed / a.registered : 0;
    const br = b.registered ? b.completed / b.registered : 0;
    return ar - br;
  });

  const totals = items.reduce(
    (acc, it) => {
      acc.registered += it.registered;
      acc.reserved += it.reserved;
      acc.completed += it.completed;
      acc.noShow += it.noShow;
      acc.cancelled += it.cancelled;
      acc.remaining += it.remaining;
      return acc;
    },
    { registered: 0, reserved: 0, completed: 0, noShow: 0, cancelled: 0, remaining: 0 }
  );

  const body: ResponseBody = {
    period: { start: periodStart, end: periodEnd },
    totals,
    items,
  };

  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}
