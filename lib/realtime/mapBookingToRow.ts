// mediswich/lib/realtime/mapBookingToRow.ts
export type DBBooking = {
  id: string;
  name: string;
  phone: string | null;
  patientBirth: string | null;
  date: Date;
  time: string;
  status: string;
  createdAt: Date;
  meta: any;
  package?: { title?: string | null; category?: string | null } | null;
};

type YMD = `${number}-${number}-${number}`;

/** 로컬 YYYY-MM-DD */
const toYMDLocal = (d: Date): YMD => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10) as YMD;
};

const isYMD = (s?: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 유효한 검사코드: 영문 1~5 + 숫자 2~6 */
const isValidExamCode = (v: any) => /^[A-Za-z]{1,5}\d{2,6}$/i.test(String(v ?? "").trim());

const birth7toYMD = (b?: string | null): string => {
  const m = /^(\d{2})(\d{2})(\d{2})-?(\d)$/.exec(String(b || "").trim());
  if (!m) return "";
  const yy = +m[1], mm = +m[2], dd = +m[3], s = +m[4];
  const century = (s === 1 || s === 2) ? 1900 : (s === 3 || s === 4) ? 2000 : 1900;
  return `${century + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};

const mapStatusKR = (s: string) => {
  const u = String(s || "").toUpperCase();
  if (u === "PENDING") return "예약신청" as const;
  if (u === "RESERVED" || u === "CONFIRMED") return "예약확정" as const;
  if (u === "COMPLETED") return "검진완료" as const;
  if (u === "CANCELED") return "취소" as const;
  if (u === "NO_SHOW") return "검진미실시" as const;
  return "예약신청" as const;
};

const categoryToLabel = (cat?: string | null) => {
  const u = String(cat || "").toUpperCase();
  if (u === "NHIS") return "공단검진";
  if (u === "CORP") return "기업/단체";
  return "종합검진";
};

export type RowKR = {
  id: string;
  고객사: string;
  수검자명: string;
  등급: string;
  생년월일: string;
  휴대폰번호?: string;
  이메일?: string;
  주소?: string;
  예약희망일: string;
  예약확정일?: string;
  검진완료일?: string;
  예약상태: "예약신청" | "예약확정" | "검진완료" | "취소" | "검진미실시";
  패키지타입: string;
  선택검사A?: string;
  선택검사B?: string;
  검사코드?: string;
  특수검진: string;
  특수물질: string;
  보건증: string;
  회사지원금: number;
  본인부담금: number;
  복용약?: string;
  병력?: string;
  예약신청일: string;
};

export function mapBookingToRow(r: DBBooking): RowKR {
  const m: any = r.meta || {};
  const status = mapStatusKR(r.status);

  const groups = Array.isArray(m?.examSnapshot?.groups) ? m.examSnapshot.groups : [];
  const selected = groups.flatMap((g: any) => (Array.isArray(g?.selected) ? g.selected : []));

  const fromMetaCodes =
    typeof m?.examCodes === "string"
      ? m.examCodes.split(/[,\s]+/).map((s: string) => s.trim()).filter(isValidExamCode)
      : [];
  const fallbackCodes = selected.map((x: any) => x?.code).filter(isValidExamCode);
  const codes = (fromMetaCodes.length ? fromMetaCodes : fallbackCodes)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(",");

  const supportKRW = Number(m?.companySupportKRW ?? 0) || 0;
  const coPayKRW = Number(m?.coPayKRW ?? 0) || 0;

  const confirmedDate = isYMD(m?.confirmedDate) ? String(m.confirmedDate) : undefined;
  const completedDate = isYMD(m?.completedDate) ? String(m.completedDate) : undefined;

  return {
    id: r.id,
    고객사: m?.corpName || m?.corp || "",
    수검자명: r.name,
    등급: m?.grade || "기타",
    생년월일: birth7toYMD(r.patientBirth),
    휴대폰번호: r.phone || "",
    이메일: m?.email || "",
    주소: m?.address ? `(${m.address.postal || ""}) ${m.address.address1 || ""} ${m.address.address2 || ""}`.trim() : "",
    예약희망일: toYMDLocal(new Date(r.date)),
    예약확정일: confirmedDate,
    검진완료일: completedDate,
    예약상태: status,
    패키지타입: m?.packageName || r.package?.title || "",
    선택검사A: m?.examSnapshot?.selectedA || "",
    선택검사B: m?.examSnapshot?.selectedB || "",
    검사코드: codes,
    특수검진: m?.specialExam || "",
    특수물질: m?.specialMaterial || "",
    보건증: m?.healthCert ? "Y" : "N",
    회사지원금: supportKRW,
    본인부담금: coPayKRW,
    복용약: m?.meds || (m?.medications ?? m?.form?.meds ?? "").toString().trim() || "없음",
    병력: m?.disease || (m?.history ?? m?.form?.disease ?? "").toString().trim() || "없음",
    예약신청일: toYMDLocal(new Date(r.createdAt)),
  };
}

/** 엑셀용 필드 */
export function extractExcelFields(b: DBBooking) {
  const m: any = b.meta || {};
  const groups = m?.examSnapshot?.groups ?? [];
  const items = Array.isArray(groups) ? groups.flatMap((g: any) => (Array.isArray(g?.selected) ? g.selected : [])) : [];

  const selectedExams = items.map((x: any) => x?.name).filter(Boolean).join(", ");

  const fromMetaCodes =
    typeof m?.examCodes === "string"
      ? m.examCodes.split(/[,\s]+/).map((s: string) => s.trim()).filter(isValidExamCode)
      : [];
  const fallbackCodes = items.map((x: any) => x?.code).filter(isValidExamCode);
  const examCodes = (fromMetaCodes.length ? fromMetaCodes : fallbackCodes)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  const examType = m?.examType || categoryToLabel(b?.package?.category);

  const toYMD = (d: Date | null | undefined) => (d ? toYMDLocal(new Date(d)) : "");

  return {
    examType,
    corp: m?.corpName || m?.corp || "",
    name: b.name,
    birth: b.patientBirth,
    wanted: toYMDLocal(new Date(b.date)),
    time: b.time,
    phone: b.phone,
    email: m?.email || "",
    zipcode: m?.address?.postal || "",
    address1: m?.address?.address1 || "",
    address2: m?.address?.address2 || "",
    spExam: m?.specialExam || "",
    spMat: m?.specialMaterial || "",
    cert: m?.healthCert ? "Y" : "N",
    pkg: m?.packageName || b.package?.title || "",
    total: Number(m?.totalKRW ?? 0) || 0,
    support: Number(m?.companySupportKRW ?? 0) || 0,
    copay: Number(m?.coPayKRW ?? 0) || 0,
    grade: m?.grade || "기타",
    selectedExams,
    examCodes,
    meds: m?.meds || "",
    history: m?.disease || "",
    surgery: m?.survey?.procedureHistory || "",
    dental: m?.survey?.teethStatus || "",
    flightPlan: m?.survey?.flightPlan2weeks || "",
    requestedAt: toYMD(b.createdAt),
    confirmedAt: isYMD(m?.confirmedDate) ? String(m.confirmedDate) : "",
    completedAt: isYMD(m?.completedDate) ? String(m.completedDate) : "",
  };
}






