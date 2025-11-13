// lib/services/booking-effective-date.ts
export type Basis = "requested" | "reserved" | "confirmed" | "completed" | "effective";

type AnyRow = { date?: any; createdAt?: any; meta?: any };

const z = (x: any): Date | null => {
  if (!x) return null;
  if (x instanceof Date && !Number.isNaN(+x)) return x;
  const d = new Date(x);
  return Number.isNaN(+d) ? null : d;
};

function safeJSON(s: unknown) {
  if (!s) return {};
  if (typeof s === "object") return s as Record<string, any>;
  try { return JSON.parse(String(s)); } catch { return {}; }
}

const fromMeta = (meta: any, keys: string[]): Date | null => {
  const m = safeJSON(meta);
  for (const k of keys) {
    const d = z(m?.[k]);
    if (d) return d;
  }
  return null;
};

/** 완료일 > 확정일 > 예약일 */
export function pickEffectiveDate(row: AnyRow): Date | null {
  const done = fromMeta(row?.meta, ["completedDate","completeDate","completed_at","검진완료일","doneAt"]);
  if (done) return done;
  const confirmed = fromMeta(row?.meta, ["confirmedDate","reserveConfirmedAt","confirmed_at","예약확정일"]);
  if (confirmed) return confirmed;
  return z(row?.date);
}

/** 기준일 스위치 */
export function pickBasisDate(row: AnyRow, basis: Basis): Date | null {
  switch (basis) {
    case "requested":  return z(row?.createdAt);
    case "reserved":   return z(row?.date);
    case "confirmed":  return fromMeta(row?.meta, ["confirmedDate","reserveConfirmedAt","confirmed_at","예약확정일"]);
    case "completed":  return fromMeta(row?.meta, ["completedDate","completeDate","completed_at","검진완료일","doneAt"]);
    case "effective":
    default:           return pickEffectiveDate(row);
  }
}




