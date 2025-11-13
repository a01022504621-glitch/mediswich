// app/(r-public)/r/[tenant]/reserve/_components/ReserveForm.client.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Props = {
  tenantSlug: string;
  packageId: string;
  defaultDate?: string;
  defaultTime?: string;
  disabled?: boolean;
};

function makeIdemKey(tenant: string, phone: string) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-4);
  const slot = Math.floor(Date.now() / 30000); // 30초 윈도우
  return `${tenant}:${digits}:${slot}`;
}

export default function ReserveForm({
  tenantSlug,
  packageId,
  defaultDate = "",
  defaultTime = "",
  disabled,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr(null);

      if (!packageId) return setErr("상품을 선택해주세요.");
      if (!date) return setErr("예약일을 선택해주세요.");
      if (!time) return setErr("예약 시간을 입력해주세요.");
      if (!name.trim()) return setErr("이름을 입력해주세요.");
      if (!phone.trim()) return setErr("휴대폰 번호를 입력해주세요.");

      const datetime = `${date} ${time}`;
      const idem = makeIdemKey(tenantSlug, phone);

      try {
        setSubmitting(true);
        const res = await fetch(`/api/public/${tenantSlug}/booking`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idem,
          },
          body: JSON.stringify({
            packageId,
            name,
            phone,
            datetime, // "YYYY-MM-DD HH:MM"
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 표준화된 에러 코드 매핑
          const code = (data?.code || data?.error || "").toString().toUpperCase();
          if (code === "FULL") return setErr("해당 시간은 예약이 마감되었습니다.");
          if (code === "CLOSED") return setErr("해당 일자는 예약을 받지 않습니다.");
          if (code === "INVALID" || res.status === 400)
            return setErr("입력값을 확인해주세요.");
          return setErr("예약 처리 중 오류가 발생했습니다.");
        }

        const bookingId = data?.id;
        // 성공 이동: 전용 페이지가 있으면 success로, 없으면 랜딩으로
        const target = bookingId
          ? `/r/${tenantSlug}/reserve/success?id=${bookingId}`
          : `/r/${tenantSlug}`;
        router.push(target);
      } catch (e) {
        setErr("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        setSubmitting(false);
      }
    },
    [tenantSlug, packageId, date, time, name, phone, router]
  );

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-3">
      <input type="hidden" name="packageId" value={packageId} />

      {err && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {err}
        </p>
      )}

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">예약일</span>
        <input
          type="date"
          name="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">시간</span>
        <input
          name="time"
          placeholder="10:30"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">이름</span>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">휴대폰</span>
        <input
          name="phone"
          required
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </label>

      <button
        className="mt-1 w-40 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:bg-slate-300"
        disabled={!!disabled || submitting}
      >
        {submitting ? "처리 중…" : "예약 확정"}
      </button>
    </form>
  );
}


