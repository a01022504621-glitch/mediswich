// app/(m-protected)/m/billing/page.tsx
import prisma from "@/lib/prisma-scope";
import { requireOrg } from "@/lib/auth";

export default async function BillingPage() {
  const org = await requireOrg();

  const sub = await prisma.hospitalSubscription.findFirst({
    where: { hospitalId: org.id },
    include: { plan: true },
  });

  const invoices = await prisma.invoice.findMany({
    where: { hospitalId: org.id },
    orderBy: { issuedAt: "desc" },
    take: 12,
  });
  type InvoiceRow = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number];

  const statusText = sub?.status ?? "미구독";
  const planName = sub?.plan?.name ?? "FREE";
  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "-";

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold">구독 상태</h2>
        <p className="text-slate-600 text-sm mt-1">
          현재 플랜: <b>{planName}</b> / 상태: <b>{statusText}</b> / 갱신일: <b>{periodEnd}</b>
        </p>
        <div className="mt-4 flex gap-2">
          <form action="/api/billing/checkout" method="post">
            <button className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:opacity-90">PRO 구독하기</button>
          </form>
          <form action="/api/billing/portal" method="post">
            <button className="rounded-lg border px-3 py-2">결제 정보 관리</button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm p-6">
        <h3 className="font-medium mb-2">결제 이력</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">기간</th>
                <th className="py-2">금액</th>
                <th className="py-2">상태</th>
                <th className="py-2">발행일</th>
                <th className="py-2">결제일</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: InvoiceRow) => (
                <tr key={inv.id} className="border-t">
                  <td className="py-2">
                    {new Date(inv.periodStart).toLocaleDateString()} ~ {new Date(inv.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-2">{(inv.amountKRW ?? 0).toLocaleString()}원</td>
                  <td className="py-2">{inv.status}</td>
                  <td className="py-2">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                  <td className="py-2">{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    결제 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm p-6">
        <h3 className="font-medium mb-2">PRO에서 열리는 기능</h3>
        <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
          <li>특정검사항목 케파 관리 (다중 항목)</li>
          <li>일괄 마감/해제, 복제/반복 적용</li>
          <li>추가 보고서 & 통계</li>
        </ul>
      </div>
    </section>
  );
}
