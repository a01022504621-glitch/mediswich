// lib/services/booking-effective-date.ts
import type { Prisma } from "@prisma/client";

// 문자열·숫자·Date 허용
function parseAnyDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pickFromMeta(meta: any, keys: string[]): Date | null {
  try {
    const obj = typeof meta === "string" ? JSON.parse(meta) : meta || {};
    for (const k of keys) {
      const d = parseAnyDate(obj?.[k]);
      if (d) return d;
    }
  } catch {}
  return null;
}

// 완료일 > 확정일 > 예약일
export function pickEffectiveDate(input: { date: Date; meta?: any }): Date {
  const done =
    pickFromMeta(input.meta, ["completedDate", "검진완료일", "completeDate", "completed_at", "doneAt", "finishedAt"]) ||
    null;
  const confirmed =
    pickFromMeta(input.meta, [
      "confirmedDate",
      "예약확정일",
      "reserveConfirmedAt",
      "confirmed_at",
      "reservationConfirmedAt",
      "reservedDate",
    ]) || null;
  return (done || confirmed || input.date) as Date;
}

// create용: data에 effectiveDate 주입
export function applyEffectiveDateForCreate(
  data: Prisma.BookingCreateInput | Prisma.BookingUncheckedCreateInput,
) {
  const date = (data as any).date as Date;
  const meta = (data as any).meta;
  const eff = pickEffectiveDate({ date, meta });
  (data as any).effectiveDate = eff;
  return data;
}

// update용: 기존값과 패치를 합쳐 재계산
export function applyEffectiveDateForUpdate(params: {
  before: { date: Date; meta?: any; effectiveDate?: Date | null };
  patch: Prisma.BookingUpdateInput | Prisma.BookingUncheckedUpdateInput;
}) {
  const nextDate = (("date" in params.patch ? (params.patch as any).date : undefined) ?? params.before.date) as Date;
  // meta는 JsonPatch 형태일 수 있으므로 전체 교체만 처리. 부분패치 환경이면 상위 서비스에서 병합 후 전달.
  const nextMeta = (("meta" in params.patch ? (params.patch as any).meta : undefined) ?? params.before.meta) as any;
  const eff = pickEffectiveDate({ date: nextDate, meta: nextMeta });
  (params.patch as any).effectiveDate = eff;
  return params.patch;
}



