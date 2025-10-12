// components/admin/notifications/TemplatesTab.tsx
"use client";
import { useState } from "react";
import { Modal } from "@/components/admin/Modal";

export default function TemplatesTab() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ name: string; body: string } | null>(null);
  const mock = [
    { id: "t1", channel: "kakao_alimtalk", code: "TMP_001", name: "예약확정 안내", body: "{{name}}님, {{date}} {{time}} 예약이 확정되었습니다." },
    { id: "t2", channel: "kakao_alimtalk", code: "TMP_002", name: "검진일 리마인드", body: "{{name}}님, 내일 {{time}}에 뵙겠습니다." },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">카카오 알림톡 템플릿 목록 (승인 필요)</div>
        <button className="h-9 px-3 rounded bg-black text-white text-sm" onClick={() => setOpen(true)}>+ 새 템플릿</button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">채널</th>
              <th className="px-3 py-2 text-left">코드</th>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">동작</th>
            </tr>
          </thead>
          <tbody>
            {mock.map(t => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">알림톡</td>
                <td className="px-3 py-2">{t.code}</td>
                <td className="px-3 py-2">{t.name}</td>
                <td className="px-3 py-2 space-x-2">
                  <button className="px-2 py-1 text-xs rounded border" onClick={() => setPreview({ name: t.name, body: t.body })}>미리보기</button>
                  <button className="px-2 py-1 text-xs rounded border">수정</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={`템플릿 미리보기 - ${preview?.name ?? ""}`}>
        <div className="text-sm whitespace-pre-wrap">
          {(preview?.body || "")
            .replaceAll("{{name}}", "홍길동")
            .replaceAll("{{date}}", "2025-09-13")
            .replaceAll("{{time}}", "09:30")}
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="새 템플릿">
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-gray-600 mb-1">이름</label>
            <input className="w-full h-9 border rounded px-3" placeholder="예: 예약확정 안내" />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">카카오 승인 코드</label>
            <input className="w-full h-9 border rounded px-3" placeholder="예: TMP_001" />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">본문</label>
            <textarea className="w-full h-32 border rounded p-2 font-mono" placeholder="{{name}}님, {{date}} {{time}} 예약이 확정되었습니다."></textarea>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 h-9 rounded border" onClick={() => setOpen(false)}>취소</button>
            <button className="px-3 h-9 rounded bg-black text-white">저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


