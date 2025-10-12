// components/admin/notifications/QueueTab.tsx
"use client";
export default function QueueTab() {
  const mock = [
    { id: "q1", when: "2025-09-13 09:00", to: "010-1234-5678", template: "검진일 리마인드", status: "queued" },
    { id: "q2", when: "2025-09-12 10:00", to: "010-2345-6789", template: "예약확정 안내", status: "sent" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">전송 큐/로그</div>
        <div className="text-xs text-gray-500">* 실제 발송 연동은 이후 단계</div>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">전송시각</th>
              <th className="px-3 py-2 text-left">수신자</th>
              <th className="px-3 py-2 text-left">템플릿</th>
              <th className="px-3 py-2 text-left">상태</th>
            </tr>
          </thead>
          <tbody>
            {mock.map(q => (
              <tr key={q.id} className="border-t">
                <td className="px-3 py-2">{q.when}</td>
                <td className="px-3 py-2">{q.to}</td>
                <td className="px-3 py-2">{q.template}</td>
                <td className="px-3 py-2">{q.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


