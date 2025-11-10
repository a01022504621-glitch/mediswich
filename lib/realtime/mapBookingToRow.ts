// lib/realtime/mapBookingToRow.ts
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

/** 코드 유효성: 영숫자 시작, 이후 영숫자/._- 허용, 최대 32자 */
const isValidExamCode = (v: any) =>
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(String(v ?? "").trim());

/** YYMMDD-# → YYYY-MM-DD (내·외국인 1~8 식별 포함) */
const birth7toYMD = (b?: string | null): string => {
  const m = /^(\d{2})(\d{2})(\d{2})-?(\d)$/.exec(String(b || "").trim());
  if (!m) return "";
  const yy = +m[1],
    mm = +m[2],
    dd = +m[3],
    s = +m[4];
  const century =
    s === 1 || s === 2 || s === 5 || s === 6
      ? 1900
      : s === 3 || s === 4 || s === 7 || s === 8
      ? 2000
      : 1900;
  return `${century + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
    2,
    "0"
  )}`;
};

const mapStatusKR = (s: string) => {
  const u = String(s || "").toUpperCase();
  if (u === "PENDING") return "예약신청" as const;
  if (u === "RESERVED" || u === "CONFIRMED" || u === "AMENDED")
    return "예약확정" as const;
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
  추가검사?: string;
  회사지원금: number;
  본인부담금: number;
  복용약?: string;
  병력?: string;
  예약신청일: string;
};

/** 스냅샷/메타에서 선택·추가검사·코드 추출 */
function extractSelections(meta: any) {
  const snap = meta?.examSnapshot || {};
  const selectedA = String(snap?.selectedA || "").trim();
  const selectedB = String(snap?.selectedB || "").trim();

  const groups: any[] = Array.isArray(snap?.groups) ? snap.groups : [];
  const selectedFromGroups: Array<{ name?: string; code?: string }> = groups.flatMap(
    (g: any) => (Array.isArray(g?.selected) ? g.selected : [])
  );
  const selectedNames = selectedFromGroups
    .map((x) => String(x?.name || "").trim())
    .filter(Boolean);

  // 1) 검사코드: 우선 순위
  //   a) snap.examCodes
  //   b) meta.examCodes (백업)
  //   c) 없으면 선택된 그룹 코드 + snap.addonCodes
  const fromDelimited = (s: string) =>
    s
      .split(/[,\s]+/u)
      .map((t) => t.trim())
      .filter(isValidExamCode);

  const rawSnapStr = typeof snap?.examCodes === "string" ? snap.examCodes : "";
  const rawMetaStr = typeof meta?.examCodes === "string" ? meta.examCodes : "";

  const codesFromSnap = rawSnapStr ? fromDelimited(rawSnapStr) : [];
  const codesFromMeta = !codesFromSnap.length && rawMetaStr ? fromDelimited(rawMetaStr) : [];

  const groupCodes = selectedFromGroups
    .map((x) => x?.code)
    .map((s) => String(s || "").trim())
    .filter(isValidExamCode);

  const addonCodes = Array.isArray(snap?.addonCodes)
    ? snap.addonCodes
        .map((s: any) => String(s || "").trim())
        .filter(isValidExamCode)
    : [];

  const codesArr =
    codesFromSnap.length ? codesFromSnap :
    codesFromMeta.length ? codesFromMeta :
    Array.from(new Set([...groupCodes, ...addonCodes]));

  const codes = codesArr.join(",");

  // 2) 추가검사명
  const basicNames: string[] = Array.isArray(meta?.exams?.basic)
    ? meta.exams.basic.map((s: any) => String(s || "").trim()).filter(Boolean)
    : [];

  const selectedAllNames = new Set(
    [...selectedNames, selectedA, selectedB].filter(Boolean)
  );
  const basicNameSet = new Set(basicNames);

  const pickAddonNames = (arr: any[]) =>
    arr
      .map((x: any) =>
        typeof x === "string"
          ? x.trim()
          : String(x?.name || x?.title || x?.id || "").trim()
      )
      .filter(Boolean);

  let addonNames: string[] = [];
  if (Array.isArray(meta?.addons) && meta.addons.length) {
    addonNames = pickAddonNames(meta.addons);
  } else if (Array.isArray(snap?.addons) && snap.addons.length) {
    addonNames = pickAddonNames(snap.addons);
  } else if (Array.isArray(meta?.exams?.addons) && meta.exams.addons.length) {
    addonNames = pickAddonNames(meta.exams.addons);
  }

  addonNames = addonNames.filter(
    (n) => n && !basicNameSet.has(n) && !selectedAllNames.has(n)
  );

  const addonStr = Array.from(new Set(addonNames)).join(", ");

  return { selectedA, selectedB, examCodes: codes, addonStr };
}

/** 테이블용 행 매핑 */
export function mapBookingToRow(r: DBBooking): RowKR {
  const m: any = r.meta || {};
  const status = mapStatusKR(r.status);

  const { selectedA, selectedB, examCodes, addonStr } = extractSelections(m);

  const supportKRW = Number(m?.companySupportKRW ?? 0) || 0;
  const coPayKRW = Number(m?.coPayKRW ?? m?.totalKRW ?? 0) || 0;

  const confirmedDate: string | undefined = isYMD(m?.confirmedDate)
    ? String(m.confirmedDate)
    : undefined;
  const completedDate: string | undefined = isYMD(m?.completedDate)
    ? String(m.completedDate)
    : undefined;

  const addr = m?.address
    ? `(${m.address.postal || ""}) ${m.address.address1 || ""} ${m.address.address2 || ""}`.trim()
    : "";

  return {
    id: r.id,
    고객사: m?.corpName || m?.corp || "",
    수검자명: r.name,
    등급: m?.grade || "기타",
    생년월일: birth7toYMD(r.patientBirth),
    휴대폰번호: r.phone || "",
    이메일: m?.email || "",
    주소: addr,
    예약희망일: toYMDLocal(new Date(r.date)),
    예약확정일: confirmedDate,
    검진완료일: completedDate,
    예약상태: status,
    패키지타입: m?.packageName || r.package?.title || categoryToLabel(r.package?.category),
    선택검사A: selectedA || undefined,
    선택검사B: selectedB || undefined,
    검사코드: examCodes || "",
    특수검진: m?.specialExam || "",
    특수물질: m?.specialMaterial || "",
    보건증: m?.healthCert ? "Y" : "N",
    추가검사: addonStr || "",
    회사지원금: supportKRW,
    본인부담금: coPayKRW,
    복용약:
      (m?.meds ?? m?.medications ?? m?.form?.meds ?? "").toString().trim() || "없음",
    병력:
      (m?.disease ?? m?.history ?? m?.form?.disease ?? "").toString().trim() || "없음",
    예약신청일: toYMDLocal(new Date(r.createdAt)),
  };
}

/** 엑셀용 평면 필드 */
export function extractExcelFields(b: DBBooking) {
  const m: any = b.meta || {};
  const { selectedA, selectedB, examCodes, addonStr } = extractSelections(m);

  const toYMD = (d: Date | null | undefined) =>
    d ? toYMDLocal(new Date(d)) : "";

  return {
    examType: m?.examType || categoryToLabel(b?.package?.category),
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
    total: Number(m?.totalKRW ?? m?.coPayKRW ?? 0) || 0,
    support: Number(m?.companySupportKRW ?? 0) || 0,
    copay: Number(m?.coPayKRW ?? m?.totalKRW ?? 0) || 0,
    grade: m?.grade || "기타",
    selectedExams: [selectedA, selectedB].filter(Boolean).join(", "),
    addons: addonStr || "",
    examCodes: examCodes || "",
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





