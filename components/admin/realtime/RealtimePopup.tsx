// components/admin/realtime/RealtimePopup.tsx
"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/admin/Modal";

export default function RealtimePopup() {
  const [open, setOpen] = useState(true);
  const [data] = useState({ new: 12, changed: 5, canceled: 2 }); // mock
  useEffect(() => { const id = setTimeout(() => setOpen(false), 4000); return () => clearTimeout(id); }, []);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="오늘의 검진현황 변동">
      <div className="grid md:grid-cols-3 gap-4">
        <Box title="예약신청" value={data.new} />
        <Box title="변경" value={data.changed} />
        <Box title="취소" value={data.canceled} />
      </div>
      <div className="mt-4 text-sm text-gray-600">상세 목록/바로가기 버튼은 데이터 연동 시 채워집니다.</div>
    </Modal>
  );
}

function Box({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}



