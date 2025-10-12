// components/admin/notifications/RulesTab.tsx
"use client";
export default function RulesTab() {
  const mock = [
    { id: "r1", trigger: "BOOKING_CONFIRMED", name: "확정시 즉시", offset: "0일 0시간 전", template: "예약확정 안내" },
    { id: "r2", trigger: "N_DAYS_BEFORE_EXAM", name: "검진일 1일 전", offset: "1일 0시간 전", template: "검진일 리마인드" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">전송 규칙</div>
        <button className="h-9 px-3 rounded bg-black text-white text-sm">+ 새 규칙</button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">트리거</th>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">전송시점</th>
              <th className="px-3 py-2 text-left">템플릿</th>
              <th className="px-3 py-2 text-left">상태</th>
            </tr>
          </thead>
          <tbody>
            {mock.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.trigger}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.offset}</td>
                <td className="px-3 py-2">{r.template}</td>
                <td className="px-3 py-2">사용</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


