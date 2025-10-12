// app/(m-protected)/m/dashboard/page.tsx
import type { ReactNode } from "react";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { BarsAndLine, CapacityMini } from "./_components/Charts.client";

async function getJSON(path: string) {
  const h = nextHeaders();
  const cookie = h.get("cookie") ?? "";
  const r = await fetch(path, {
    cache: "no-store",
    redirect: "manual",
    headers: { cookie, accept: "application/json" },
  });

  // 비인증 또는 리다이렉트 대응
  if (r.status === 401 || r.status === 307) redirect(`/m/login?next=/m/dashboard`);

  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) redirect(`/m/login?next=/m/dashboard`);

  return r.json();
}

async function getKPIs() {
  try {
    return await getJSON("/api/m/dashboard/kpis");
  } catch {
    return { today: { requested: 0, confirmed: 0, canceled: 0, cancelRate: 0 }, next7: { confirmed: 0, revenue: 0 }, overdue: { count: 0 } };
  }
}
async function getOverdue() {
  try {
    return await getJSON("/api/m/overdue?limit=10");
  } catch {
    return { items: [], total: 0 };
  }
}
async function getTrends() {
  try {
    return await getJSON("/api/m/dashboard/trends");
  } catch {
    return { series: [] as any[] };
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
      <div className="text-[13px] font-semibold text-slate-600">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default async function Page() {
  const [kpi, overdue, trend] = await Promise.all([getKPIs(), getOverdue(), getTrends()]);
  const series = trend.series ?? [];

  return (
    <main className="p-4 sm:p-6 space-y-6">
      {/* KPI + 미니 가동률 */}
      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4">
        <Card title="오늘 요청(REQUESTED)"><div className="text-3xl font-extrabold">{kpi.today.requested}</div></Card>
        <Card title="오늘 확정(CONFIRMED)"><div className="text-3xl font-extrabold">{kpi.today.confirmed}</div></Card>
        <Card title="오늘 취소(CANCELED)"><div className="text-3xl font-extrabold">{kpi.today.canceled}</div></Card>
        <Card title="오늘 취소율"><div className="text-3xl font-extrabold">{kpi.today.cancelRate}<span className="text-base ml-1">%</span></div></Card>
        <Card title="7일 예약 수"><div className="text-3xl font-extrabold">{kpi.next7.confirmed}</div></Card>
        <Card title="7일 매출 예상"><div className="text-3xl font-extrabold">{kpi.next7.revenue.toLocaleString()}<span className="text-base ml-1">원</span></div></Card>
        <Card title="가동률(오늘)"><CapacityMini data={series} /></Card>
      </section>

      {/* 추세 차트 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
          <div className="flex items-center">
            <div className="text-[15px] font-semibold text-slate-800">14일 추세</div>
          </div>
          <div className="mt-3">
            <BarsAndLine data={series} />
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
          <div className="text-[15px] font-semibold text-slate-800">최근 공지</div>
          <p className="mt-2 text-sm text-slate-600">공지 편집에서 최신 안내를 등록하세요.</p>
          <a href="/m/org/settings" className="mt-3 inline-flex rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
            공지 편집
          </a>
        </div>
      </section>

      {/* 미수검 표 */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
        <div className="flex items-center">
          <div className="text-[15px] font-semibold text-slate-800">미수검 추적</div>
          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{kpi.overdue.count}</span>
          <a href="/m/realtime" className="ml-auto text-sm text-blue-600 hover:underline">실시간 현황</a>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-500">
              <tr><th className="text-left py-2">예약일</th><th className="text-left py-2">패키지</th><th className="text-left py-2">고객사</th></tr>
            </thead>
            <tbody className="text-slate-800">
              {overdue.items.length === 0 ? (
                <tr><td colSpan={3} className="py-6 text-center text-slate-500">미수검 대상 없음</td></tr>
              ) : overdue.items.map((x: any) => (
                <tr key={x.id} className="border-t border-slate-200/80">
                  <td className="py-2">{new Date(x.date).toLocaleDateString()}</td>
                  <td className="py-2">{x.packageName ?? "-"}</td>
                  <td className="py-2">{x.clientName ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}


