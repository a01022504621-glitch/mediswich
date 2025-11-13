// app/(r-public)/r/[tenant]/schedule/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ================= util ================= */
function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
const tone = {
  bg: "bg-[#f7f8fb]",
  card: "bg-white",
  line: "ring-1 ring-slate-200",
  brand: "bg-[#2457ff] text-white",
  brandHover: "hover:bg-[#1d46cc]",
};

const STEPS = [
  { key: "terms", ko: "약관동의", en: "Terms" },
  { key: "info", ko: "예약자 정보", en: "Patient" },
  { key: "exam", ko: "검사항목", en: "Exams" },
  { key: "date", ko: "예약일", en: "Date" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

/* ===== Package/Exam types ===== */
type PkgItem = {
  id?: string;
  code?: string;
  examId?: string;
  name?: string;
  price?: number | null;
  sex?: "M" | "F" | string | null;
  gender?: "M" | "F" | string | null;
  sexNormalized?: "M" | "F" | string | null;
};
type PackageGroup = {
  id?: string;
  label?: string;
  chooseCount?: number | null;
  items: PkgItem[];
};
type PackagePayload = {
  id: string;
  name: string;
  title?: string;
  price?: number | null;
  basicExams: string[];
  optionGroups: PackageGroup[];
};

/* ===== Capacity/Slots types ===== */
type CapacityMonth = Record<string, "OPEN" | "CLOSED">;
type Slot = { time: string; status: "OPEN" | "CLOSED" | "FULL" };

/* ===== Add-on types ===== */
type Addon = {
  id: string;
  name: string;
  code?: string | null;
  price?: number | null;
  sex?: "M" | "F" | string | null;
  visible?: boolean;
};

/* ===== Exam catalog (이름→코드 매핑) ===== */
type ExamCatalogMap = Record<string, string>; // key: normalized name, value: code

/* ===== helpers ===== */
const trimOrNull = (v: unknown) => (typeof v === "string" ? v.trim() || null : (v as any) ?? null);
const rawItemKey = (x: PkgItem) =>
  (trimOrNull(x?.id) ?? trimOrNull(x?.code) ?? trimOrNull(x?.examId) ?? trimOrNull(x?.name)) as string | null;
const itemKeyFrom = (x: PkgItem, idx: number) => (rawItemKey(x) as string) || `idx_${idx}`;
const groupIdOf = (g: PackageGroup, idx: number) => {
  const cand = (trimOrNull(g?.id) ?? trimOrNull(g?.label)) as string | null;
  return cand && cand.length ? cand : `grp_${idx}`;
};

/* 이름 정규화: 모든 공백 제거 + 소문자 */
const normName = (s: unknown) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtYMD(d: Date) {
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}
function ymdKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function yyyymm(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

/* noStoreUrl: 타임스탬프 파라미터 추가 금지(중복요청 유발 방지) */
function noStoreUrl(url: string) {
  return url;
}

/* 성별 */
function inferSexFromDigit(d?: string) {
  const n = Number(d);
  if ([1, 3, 5, 7].includes(n)) return "M";
  if ([2, 4, 6, 8].includes(n)) return "F";
  return "" as "" | "M" | "F";
}
function normalizeSex(x?: any): "" | "M" | "F" {
  const v = (x ?? "").toString().trim().toUpperCase();
  if (["M", "MALE", "남", "남성", "남자"].includes(v)) return "M";
  if (["F", "FEMALE", "여", "여성", "여자"].includes(v)) return "F";
  return "" as "" | "M" | "F";
}
function getItemSexMeta(x: any): "" | "M" | "F" {
  return normalizeSex(x?.sexNormalized) || normalizeSex(x?.sex) || normalizeSex(x?.gender) || "";
}
function isItemAllowedBySex(item: PkgItem | Addon, userSex: "" | "M" | "F") {
  const meta = getItemSexMeta(item);
  if (!meta || !userSex) return true;
  return meta === userSex;
}

/* 캘린더(6주) */
function buildCalendar(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  const day = first.getDay();
  start.setDate(first.getDate() - day);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    cells.push({ date: dt, inMonth: dt.getMonth() === cursor.getMonth() });
  }
  return cells;
}

/* 검사코드 유효성: 영숫자 시작, 이후 영숫자/._- 허용, 1~32자 */
const isValidExamCode = (v: any) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(String(v ?? "").trim());

/* ====================================================================== */
/* Page */
/* ====================================================================== */
export default function Page({ params }: { params: { tenant: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const packageId = sp.get("packageId") || sp.get("id") || "";
  const corpCode = sp.get("code") || undefined;
  const corpNameQ = sp.get("corpName") || undefined;

  const [stepIndex, setStepIndex] = useState(0);
  const stepKey: StepKey = STEPS[stepIndex].key;

  const [pkg, setPkg] = useState<PackagePayload | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [catalog, setCatalog] = useState<ExamCatalogMap>({});
  const [monthMap, setMonthMap] = useState<CapacityMonth>({});
  const [slots, setSlots] = useState<Slot[]>([]);

  const [form, setForm] = useState<any>({
    terms: { all: false, privacy: false, notify: false },
    foreigner: false,
    name: "",
    birth7: "",
    sex: "" as "" | "M" | "F",
    phone: "",
    email: "",
    meds: "",
    disease: "",
    postal: "",
    address1: "",
    address2: "",
    showBasic: false,
    showAddons: false,
    examSelected: {} as Record<string, string[]>,
    selectedAddons: [] as string[],
    date: new Date(),
    time: "",
    survey: { procedureHistory: "", teethStatus: "", flightPlan2weeks: "" },
  });

  const t = (ko: string, en: string) => (form.foreigner ? en : ko);

  /* ------- 데이터 로딩 ------- */
  useEffect(() => {
    if (!packageId) return;
    fetchPackage(params.tenant, packageId, corpCode).then(setPkg).catch(() => setPkg(null));
  }, [params.tenant, packageId, corpCode]);

  useEffect(() => {
    fetchAddons(params.tenant).then(setAddons).catch(() => setAddons([]));
  }, [params.tenant]);

  useEffect(() => {
    fetchExamCatalog(params.tenant).then(setCatalog).catch(() => setCatalog({}));
  }, [params.tenant]);

  /* ------- 선택 내시경 여부 ------- */
  const endoscopyFlags = useMemo(() => {
    const { groups } = filteredGroups();
    const selectedKeys = form.examSelected || {};
    const selectedNames: string[] = [];
    groups.forEach((g, gi) => {
      const gid = groupIdOf(g, gi);
      const keys = new Set(selectedKeys[gid] || []);
      (g.items || []).forEach((it, xi) => {
        const key = itemKeyFrom(it, xi);
        if (keys.has(key)) selectedNames.push(it.name || "");
      });
    });
    const hasEGD = selectedNames.some((n) => /위\s*내시경/i.test(n));
    const hasColo = selectedNames.some((n) => /대장\s*내시경/i.test(n));
    return { hasEGD, hasColo, any: hasEGD || hasColo };
  }, [form.examSelected, form.sex, pkg]);

  /* ------- 월/슬롯 ------- */
  const monthAbortRef = useRef<AbortController | null>(null);
  const slotsAbortRef = useRef<AbortController | null>(null);

  // 간단 스로틀: 동일 키에 대해 30초 내 재요청 차단(수동 새로고침은 예외)
  const monthFetchStamp = useRef<{ key: string; at: number } | null>(null);
  const slotFetchStamp = useRef<{ key: string; at: number } | null>(null);

  const loadMonth = useCallback(
    async (ym: string, force = false) => {
      const throttleMs = 30_000;
      const key = `${params.tenant}:${ym}:${endoscopyFlags.hasEGD ? 1 : 0}:${endoscopyFlags.hasColo ? 1 : 0}`;
      const now = Date.now();
      if (!force && monthFetchStamp.current && monthFetchStamp.current.key === key && now - monthFetchStamp.current.at < throttleMs) return;
      monthFetchStamp.current = { key, at: now };

      monthAbortRef.current?.abort();
      const ctl = new AbortController();
      monthAbortRef.current = ctl;
      try {
        const map = await fetchCapacityMonthSmart(
          params.tenant,
          ym,
          { needEGD: endoscopyFlags.hasEGD, needCol: endoscopyFlags.hasColo },
          ctl.signal
        );
        setMonthMap(map);
      } catch (e: any) {
        if (e?.name !== "AbortError") setMonthMap({});
      }
    },
    [params.tenant, endoscopyFlags.hasEGD, endoscopyFlags.hasColo]
  );

  const loadSlots = useCallback(
    async (dateKey: string, force = false) => {
      const throttleMs = 15_000;
      const key = `${params.tenant}:${dateKey}`;
      const now = Date.now();
      if (!force && slotFetchStamp.current && slotFetchStamp.current.key === key && now - slotFetchStamp.current.at < throttleMs) return;
      slotFetchStamp.current = { key, at: now };

      slotsAbortRef.current?.abort();
      const ctl = new AbortController();
      slotsAbortRef.current = ctl;
      try {
        const s = await fetchSlots(params.tenant, dateKey, ctl.signal);
        setSlots(s);
      } catch (e: any) {
        if (e?.name !== "AbortError") setSlots([]);
      }
    },
    [params.tenant]
  );

  useEffect(() => {
    if (stepKey !== "date") return;
    loadMonth(yyyymm(form.date));
    loadSlots(ymdKey(form.date));
  }, [stepKey, form.date, loadMonth, loadSlots]);

  useEffect(() => {
    if (stepKey !== "date") return;
    const refresh = () => {
      loadMonth(yyyymm(form.date), true); // 수동/포커스 갱신은 스로틀 무시
      loadSlots(ymdKey(form.date), true);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [stepKey, form.date, loadMonth, loadSlots]);

  /* ------- 입력 마스크 ------- */
  function setBirthMasked(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 7);
    const masked = digits.length <= 6 ? digits : `${digits.slice(0, 6)}-${digits.slice(6, 7)}`;
    const sex = inferSexFromDigit(digits[6]);
    setForm((f: any) => ({ ...f, birth7: masked, sex }));
  }
  function setPhoneMasked(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    let out = d;
    if (d.startsWith("010")) {
      if (d.length > 3 && d.length <= 7) out = `${d.slice(0, 3)}-${d.slice(3)}`;
      else if (d.length > 7) out = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    }
    setForm((f: any) => ({ ...f, phone: out }));
  }

  /* 성별 변경 시 선택 보정 */
  useEffect(() => {
    if (!pkg) return;
    const sex = form.sex as "" | "M" | "F";
    const groups = (pkg?.optionGroups || []).map((g, gi) => ({
      gid: groupIdOf(g, gi),
      keys: (g.items || []).filter((it) => isItemAllowedBySex(it, sex)).map((it, xi) => itemKeyFrom(it, xi)),
    }));
    setForm((f: any) => {
      const prev = f.examSelected || {};
      const next: Record<string, string[]> = { ...prev };
      groups.forEach(({ gid, keys }) => {
        const set = new Set(keys);
        next[gid] = (prev[gid] || []).filter((k: string) => set.has(k));
      });
      return { ...f, examSelected: next };
    });
  }, [form.sex, pkg]); // eslint-disable-line

  /* 기본검사 이름 Set */
  const basicNameSet = useMemo(() => {
    const names = (pkg?.basicExams || []).map(normName);
    return new Set(names.filter(Boolean));
  }, [pkg]);

  /* Add-on 가시/합계 */
  const visibleAddons = useMemo(
    () =>
      (addons || [])
        .filter((a) => a.visible !== false && isItemAllowedBySex(a, form.sex as "" | "M" | "F"))
        .filter((a) => !basicNameSet.has(normName(a.name))),
    [addons, form.sex, basicNameSet]
  );
  const addonTotal = useMemo(
    () =>
      visibleAddons
        .filter((a) => (form.selectedAddons || []).includes(a.id))
        .reduce((s, a) => s + (Number(a.price ?? 0) || 0), 0),
    [visibleAddons, form.selectedAddons]
  );
  const payToday = (Number(pkg?.price) || 0) + addonTotal;

  /* 진행 가능 판단 */
  const canNext = useMemo(() => {
    const k = STEPS[stepIndex].key;
    if (k === "terms") return form.terms.privacy && form.terms.notify;
    if (k === "info") {
      const phoneOk = /^010-\d{3,4}-\d{4}$/.test(form.phone);
      const birthOk = /^\d{6}-\d$/.test(form.birth7);
      return form.name && phoneOk && birthOk && form.postal && form.address1 && form.address2;
    }
    if (k === "exam") {
      const groups = filteredGroups().groups;
      return groups.every((g, idx) => {
        const gid = groupIdOf(g, idx);
        const need = Math.max(0, Number(g.chooseCount) || 0);
        if (need === 0) return true;
        return (form.examSelected?.[gid]?.length || 0) === need;
      });
    }
    if (k === "date") return Boolean(form.date) && Boolean(form.time);
    return true;
  }, [stepIndex, form]);

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }
  function goNext() {
    if (!canNext) return;
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else openSummary();
  }

  function filteredGroups() {
    const sex = form.sex as "" | "M" | "F";
    const basic = pkg?.basicExams || [];
    const groups = (pkg?.optionGroups || []).map((g) => ({
      ...g,
      items: (g.items || []).filter((it) => isItemAllowedBySex(it, sex)),
    }));
    return { basic, groups };
  }

  const [showSheet, setShowSheet] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  function openSummary() {
    setShowSheet(true);
  }

  async function submitBooking() {
    if (submitBusy) return;
    setSubmitBusy(true);
    const payload = buildBookingPayload(
      params.tenant,
      packageId,
      pkg,
      form,
      { corpCode: corpCode || undefined, corpName: corpNameQ || undefined },
      visibleAddons,
      catalog
    );
    const r = await createBooking(payload);
    if (r.ok) {
      setShowSheet(false);
      alert("예약신청이 완료되었습니다.");
      router.replace(`/r/${params.tenant}`);
    } else {
      setSubmitBusy(false);
      alert(r.msg || t("오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "Error. Try again."));
    }
  }

  const showCorpBanner = Boolean(corpCode || corpNameQ);

  /* ====================================================================== */
  /* render */
  /* ====================================================================== */
  return (
    <div className={cx("min-h-[100dvh]", tone.bg)}>
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/95 border-b border-slate-200">
        <div className="mx-auto w-full max-w-[640px] px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wide text-slate-500">{params.tenant}</div>
              <h1 className="text-base font-bold leading-tight">검진 예약</h1>
            </div>
            <button
              onClick={() => router.back()}
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition"
              aria-label="close"
            >
              닫기
            </button>
          </div>
        </div>
        <Stepper current={stepIndex} foreigner={form.foreigner} />
      </header>

      <main className="mx-auto w-full max-w-[640px] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+180px)]">
        {showCorpBanner && (
          <section className={cx("rounded-3xl p-4 mb-3", tone.card, tone.line)}>
            <div className="text-[12px] text-slate-600">기업/단체</div>
            <div className="text-sm font-semibold mt-0.5">
              {(corpNameQ || "기업코드") + (corpCode ? ` (${corpCode})` : "")}
            </div>
          </section>
        )}

        {STEPS[stepIndex].key === "terms" && <StepTerms form={form} setForm={setForm} t={t} />}
        {STEPS[stepIndex].key === "info" && (
          <StepInfo form={form} setForm={setForm} setBirthMasked={setBirthMasked} setPhoneMasked={setPhoneMasked} t={t} />
        )}
        {STEPS[stepIndex].key === "exam" && (
          <StepExam
            form={form}
            setForm={setForm}
            pkgName={pkg?.name ?? pkg?.title ?? "-"}
            pkgBasic={filteredGroups().basic}
            pkgGroups={filteredGroups().groups}
            pkgPrice={Number(pkg?.price) || 0}
            addons={visibleAddons}
            endoscopyFlags={endoscopyFlags}
            sex={form.sex}
            t={t}
          />
        )}
        {STEPS[stepIndex].key === "date" && (
          <StepDate
            form={form}
            setForm={setForm}
            monthMap={monthMap}
            slots={slots}
            t={t}
            onMonthChange={(ym) => loadMonth(ym)}
            onRefresh={() => {
              loadMonth(yyyymm(form.date), true); // 수동 새로고침은 강제
              loadSlots(ymdKey(form.date), true);
            }}
          />
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {STEPS[stepIndex].key === "exam" && (
            <div className="w-full mb-3 rounded-2xl px-4 py-3 border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold">
              당일 결제 비용 <span className="float-right">{payToday.toLocaleString()}원</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={goPrev}
              className="h-12 flex-1 rounded-2xl border border-slate-200 bg-white text-slate-700 font-medium active:scale-[0.99] disabled:opacity-40"
              disabled={stepIndex === 0 || submitBusy}
            >
              이전
            </button>
            <button
              onClick={goNext}
              className={cx(
                "h-12 flex-1 rounded-2xl font-semibold active:scale-[0.99]",
                canNext ? tone.brand : "bg-slate-300 text-white",
                canNext && tone.brandHover
              )}
              disabled={!canNext || submitBusy}
            >
              {stepIndex < 3 ? "다음" : "예약신청"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 text-center">진행 단계 {stepIndex + 1} / 4</p>
        </div>
      </footer>

      {showSheet && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => !submitBusy && setShowSheet(false)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[640px] rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">예약 요약</h3>
            <div className="space-y-2">
              <Row key="name" k="이름" v={form.name || "-"} />
              <Row key="phone" k="연락처" v={form.phone} />
              <Row key="birth" k="생년월일" v={form.birth7} />
              <Row key="sex" k="성별" v={form.sex || "-"} />
              <Row key="addr" k="주소" v={`(${form.postal}) ${form.address1} ${form.address2 || ""}`} />
              <Row key="dt" k="날짜/시간" v={`${fmtYMD(form.date)} ${form.time}`} />
              {showCorpBanner && <Row key="corp" k="고객사" v={`${corpNameQ || ""}${corpCode ? ` (${corpCode})` : ""}`} />}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="h-12 rounded-2xl border border-slate-200" onClick={() => !submitBusy && setShowSheet(false)} disabled={submitBusy}>
                취소
              </button>
              <button
                className={cx("h-12 rounded-2xl font-semibold", tone.brand, tone.brandHover, submitBusy && "opacity-60 pointer-events-none")}
                onClick={submitBooking}
                disabled={submitBusy}
              >
                {submitBusy ? "처리 중..." : "예약신청하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/* Stepper */
/* ====================================================================== */
function Stepper({ current, foreigner }: { current: number; foreigner: boolean }) {
  const pct = Math.round(((current + 1) / 4) * 100);
  return (
    <div className="border-t border-slate-200">
      <div className="mx-auto w-full max-w-[640px] px-4 py-2">
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-[#2457ff] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-4 text-center text-[11px] text-slate-600">
          {STEPS.map((s, i) => (
            <div key={s.key} className="truncate">
              <span className={cx(i === current && "font-semibold text-slate-800")}>{foreigner ? s.en : s.ko}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* Terms */
/* ====================================================================== */
function StepTerms({ form, setForm, t }: { form: any; setForm: any; t: (ko: string, en: string) => string }) {
  const { terms } = form;
  const set = (next: Partial<typeof terms>) => setForm((f: any) => ({ ...f, terms: { ...f.terms, ...next } }));
  const allChecked = terms.privacy && terms.notify;
  useEffect(() => {
    if (terms.all !== allChecked) set({ all: allChecked });
  }, [allChecked]); // eslint-disable-line
  function toggleAll(v: boolean) {
    set({ all: v, privacy: v, notify: v });
  }

  return (
    <section className="space-y-4">
      <Card>
        <label className="flex items-center gap-3 select-none p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <input type="checkbox" checked={terms.all} onChange={(e) => toggleAll(e.target.checked)} className="size-5 rounded border-slate-300" />
          <div className="text-[15px] font-semibold">전체 동의합니다</div>
        </label>
        <CheckRow
          checked={terms.privacy}
          onChange={(v) => set({ privacy: v })}
          label={
            <>
              개인정보 수집 및 이용 동의 <b className="text-rose-500">(필수)</b>
            </>
          }
          content={TERMS_PRIVACY}
        />
        <CheckRow
          checked={terms.notify}
          onChange={(v) => set({ notify: v })}
          label={
            <>
              예약 관련 문자 수신 <b className="text-rose-500">(필수)</b>
            </>
          }
          content={TERMS_NOTIFY}
        />
      </Card>
    </section>
  );
}
function CheckRow({ checked, onChange, label, content }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; content: string }) {
  return (
    <div className="rounded-2xl border border-slate-200">
      <label className="flex items-center gap-3 select-none p-3">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4" />
        <div className="text-sm font-medium">{label}</div>
      </label>
      <div className="px-3 pb-3">
        <textarea readOnly className="w-full h-32 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600" value={content} />
      </div>
    </div>
  );
}
const TERMS_PRIVACY = `1. 개인정보 수집 및 이용 목적: 예약 관련 상담 및 처리
2. 수집 항목: 성명, 연락처, 생년월일, 주소(검진물품 발송 시) 등
3. 보유 및 이용 기간: 관련 법령에 따른 기간 보관 후 파기
* 제공 동의를 거부할 권리가 있으나, 거부 시 서비스 이용에 제한이 있을 수 있습니다.`;
const TERMS_NOTIFY = `예약 관련 안내(SMS/LMS) 수신 동의. 거부 시 예약 서비스 제공에 제약이 있을 수 있습니다.`;

/* ====================================================================== */
/* Info */
/* ====================================================================== */
function StepInfo({
  form,
  setForm,
  setBirthMasked,
  setPhoneMasked,
  t,
}: {
  form: any;
  setForm: any;
  setBirthMasked: (v: string) => void;
  setPhoneMasked: (v: string) => void;
  t: (ko: string, en: string) => string;
}) {
  return (
    <section className="space-y-4">
      <Card>
        <div className="flex items-end justify-between gap-3">
          <Field label={<LabelWithStar text="검진자명" required />}>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((f: any) => ({
                  ...f,
                  name: f.foreigner ? e.target.value.replace(/[^A-Za-z \-]/g, "") : e.target.value,
                }))
              }
              className={inputClass}
              placeholder="홍길동"
            />
          </Field>
          <label className="mb-3 inline-flex items-center gap-2 whitespace-nowrap">
            <input type="checkbox" checked={form.foreigner} onChange={(e) => setForm((f: any) => ({ ...f, foreigner: e.target.checked }))} className="h-4 w-4" />
            <span className="text-sm text-slate-700">외국인(EN)</span>
          </label>
        </div>

        <Field label={<LabelWithStar text="생년월일 (YYMMDD-#)" required />}>
          <input value={form.birth7} onChange={(e) => setBirthMasked(e.target.value)} className={inputClass} inputMode="numeric" placeholder="YYMMDD-#" />
          <p className="mt-1 text-[11px] text-slate-500">예: 930715-1, 000101-2</p>
        </Field>

        <Field label={<LabelWithStar text="핸드폰" required />}>
          <input value={form.phone} onChange={(e) => setPhoneMasked(e.target.value)} className={inputClass} inputMode="numeric" placeholder="010-0000-0000" />
        </Field>

        <Field label="이메일">
          <input value={form.email} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="example@email.com" />
        </Field>

        <Field label="복용약">
          <input value={form.meds} onChange={(e) => setForm((f: any) => ({ ...f, meds: e.target.value }))} className={inputClass} placeholder="복용 중인 약이 있으면 입력" />
        </Field>
        <Field label="병력">
          <input value={form.disease} onChange={(e) => setForm((f: any) => ({ ...f, disease: e.target.value }))} className={inputClass} placeholder="병력 또는 수술력" />
        </Field>

        <Field label={<LabelWithStar text="검진물품 배송지" required />}>
          <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
            <input value={form.postal} readOnly className={inputClass} placeholder="우편번호" />
            <button type="button" className="px-3 rounded-xl border border-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50" onClick={openPostcode(setForm)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-600">
                <path d="M11 19a 8 8 0 1 1 5.292-14.01A8 8 0 0 1 11 19Zm10 2-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="text-sm">주소검색</span>
            </button>
          </div>
          <input value={form.address1} readOnly className={cx(inputClass, "mb-2 bg-slate-50")} placeholder="주소" />
          <input value={form.address2} onChange={(e) => setForm((f: any) => ({ ...f, address2: e.target.value }))} className={inputClass} placeholder="상세주소" />
          <p className="mt-1 text-xs text-slate-500">기본주소는 “주소검색”으로만 입력됩니다.</p>
        </Field>
      </Card>
    </section>
  );
}
function LabelWithStar({ text, required }: { text: string; required?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{text}</span>
      {required && <span className="text-rose-500">*</span>}
    </span>
  );
}

/* Postcode */
function openPostcode(setForm: React.Dispatch<React.SetStateAction<any>>) {
  return async () => {
    await ensureDaumPostcode();
    const layer = document.createElement("div");
    layer.id = "postcode-layer";
    layer.style.cssText =
      "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;";
    const box = document.createElement("div");
    box.style.cssText =
      "width:min(520px,96vw);height:min(520px,80vh);background:#fff;border-radius:16px;overflow:hidden;position:relative;box-shadow:0 10px 30px rgba(0,0,0,.2);";
    const wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;height:100%;";
    const close = document.createElement("button");
    close.textContent = "✕";
    close.style.cssText =
      "position:absolute;right:8px;top:8px;border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:4px 8px;cursor:pointer;z-index:1;";
    close.onclick = () => document.body.removeChild(layer);
    box.appendChild(close);
    box.appendChild(wrap);
    layer.appendChild(box);
    document.body.appendChild(layer);

    const w = window as any;
    new w.daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.roadAddress || data.address;
        setForm((f: any) => ({ ...f, postal: data.zonecode, address1: addr }));
        document.body.removeChild(layer);
      },
      width: "100%",
      height: "100%",
    }).embed(wrap);
  };
}
function ensureDaumPostcode() {
  return new Promise<void>((resolve) => {
    const w = window as any;
    if (w.daum?.Postcode) return resolve();
    const s = document.createElement("script");
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

/* ====================================================================== */
/* Exam */
/* ====================================================================== */
function StepExam({
  form,
  setForm,
  pkgName,
  pkgBasic,
  pkgGroups,
  pkgPrice,
  addons,
  endoscopyFlags,
  sex,
  t,
}: {
  form: any;
  setForm: any;
  pkgName: string;
  pkgBasic: string[];
  pkgGroups: PackageGroup[];
  pkgPrice: number;
  addons: Addon[];
  endoscopyFlags: { hasEGD: boolean; hasColo: boolean; any: boolean };
  sex: "" | "M" | "F";
  t: (ko: string, en: string) => string;
}) {
  function toggle(groupId: string, itemKey: string, limit: number) {
    setForm((f: any) => {
      const map: Record<string, string[]> = { ...(f.examSelected || {}) };
      const current = new Set(map[groupId] || []);
      if (current.has(itemKey)) current.delete(itemKey);
      else {
        if (current.size >= limit && limit > 0) return f;
        current.add(itemKey);
      }
      map[groupId] = Array.from(current);
      return { ...f, examSelected: map };
    });
  }
  function resetGroup(groupId: string) {
    setForm((f: any) => ({ ...f, examSelected: { ...(f.examSelected || {}), [groupId]: [] } }));
  }
  function toggleAddon(id: string) {
    setForm((f: any) => {
      const cur = new Set<string>(f.selectedAddons || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...f, selectedAddons: Array.from(cur) };
    });
  }

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[12px] text-slate-500">선택 패키지</div>
            <div className="text-sm font-semibold truncate">{pkgName}</div>
          </div>
          <div className="text-sm font-bold">{pkgPrice.toLocaleString()}원</div>
        </div>
      </Card>

      <Card title="기본검사">
        <button onClick={() => setForm((f: any) => ({ ...f, showBasic: !f.showBasic }))} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-left">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">기본검사 보기</div>
            <div className="text-[12px] text-slate-500">{pkgBasic.length}</div>
          </div>
        </button>
        {form.showBasic && (
          <ul className="mt-3 text-[13px] text-slate-700 space-y-1">
            {pkgBasic.map((x) => (
              <li key={x} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                {x}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pkgGroups.map((g, gi) => {
        const gid = groupIdOf(g, gi);
        const need = Math.max(0, Number(g.chooseCount) || 0);
        const picked = form.examSelected?.[gid]?.length || 0;
        return (
          <Card key={gid} title={g.label || "선택검사"} caption={need ? `${picked} / ${need} 선택` : undefined}>
            {need === 0 && <p className="text-sm text-slate-500 mb-2">선택사항 없음</p>}
            <div className="grid grid-cols-1 gap-2">
              {(g.items || []).filter((it) => isItemAllowedBySex(it, sex)).map((x, xi) => {
                const key = itemKeyFrom(x, xi);
                const active = (form.examSelected?.[gid] || []).includes(key);
                const lock = !active && picked >= need && need > 0;
                return (
                  <button
                    key={key}
                    onClick={() => toggle(gid, key, need || 999)}
                    disabled={lock}
                    className={cx(
                      "px-4 py-3 rounded-2xl text-sm border text-left transition",
                      active ? "border-[#2457ff] bg-[#eff3ff] text-[#163ec9]" : "border-slate-200 bg-white hover:bg-slate-50",
                      lock && "opacity-50 cursor-not-allowed"
                    )}
                    title={lock ? `최대 ${need}개까지 선택` : undefined}
                  >
                    <div className="font-medium">{x?.name || "-"}</div>
                    {x?.price ? <div className="text-[11px] opacity-80 mt-0.5">{Number(x.price).toLocaleString()}원</div> : null}
                  </button>
                );
              })}
            </div>
            {need > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={picked === need ? "text-emerald-600" : "text-rose-600"}>{picked === need ? "선택 완료" : `${need - picked}개 더 선택`}</span>
                <button onClick={() => resetGroup(gid)} className="underline text-slate-500">
                  선택 초기화
                </button>
              </div>
            )}
          </Card>
        );
      })}

      {endoscopyFlags.any && (
        <Card title="추가 문진">
          <div className="grid gap-2">
            <Field label="수술/시술 이력">
              <input
                className={inputClass}
                value={form.survey?.procedureHistory || ""}
                onChange={(e) => setForm((f: any) => ({ ...f, survey: { ...f.survey, procedureHistory: e.target.value } }))}
                placeholder="있다면 입력"
              />
            </Field>
            <Field label="치아 상태">
              <input
                className={inputClass}
                value={form.survey?.teethStatus || ""}
                onChange={(e) => setForm((f: any) => ({ ...f, survey: { ...f.survey, teethStatus: e.target.value } }))}
                placeholder="브릿지/틀니 여부 등"
              />
            </Field>
            {(endoscopyFlags.hasColo || (endoscopyFlags.hasEGD && endoscopyFlags.hasColo)) && (
              <Field label="검진 후 2주이내 비행계획">
                <div className="flex gap-2">
                  {["없음", "있음"].map((k) => (
                    <button
                      key={k}
                      className={cx(
                        "px-3 py-2 rounded-xl border text-sm",
                        form.survey?.flightPlan2weeks === k ? "border-[#2457ff] bg-[#eff3ff] text-[#163ec9]" : "border-slate-200 bg-white"
                      )}
                      onClick={() => setForm((f: any) => ({ ...f, survey: { ...f.survey, flightPlan2weeks: k } }))}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </Card>
      )}

      <Card title="추가검사" caption={addons.length ? `${addons.length}개` : undefined}>
        <button onClick={() => setForm((f: any) => ({ ...f, showAddons: !f.showAddons }))} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-left">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">추가검사 보기</div>
            <div className="text-[12px] text-slate-500">{addons.length}</div>
          </div>
        </button>
        {form.showAddons && (
          <ul className="mt-3 text-[13px] text-slate-700 space-y-2">
            {addons.map((a) => {
              const active = (form.selectedAddons || []).includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => toggleAddon(a.id)}
                    className={cx(
                      "w-full px-3 py-2 rounded-xl border flex items-center justify-between",
                      active ? "border-[#2457ff] bg-[#eff3ff] text-[#163ec9]" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="font-medium">{(Number(a.price) || 0).toLocaleString()}원</span>
                  </button>
                </li>
              );
            })}
            {addons.length === 0 && <li className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">등록된 항목이 없습니다.</li>}
          </ul>
        )}
      </Card>
    </section>
  );
}

/* ====================================================================== */
/* Date */
/* ====================================================================== */
function StepDate({
  form,
  setForm,
  monthMap,
  slots,
  t,
  onMonthChange,
  onRefresh,
}: {
  form: any;
  setForm: any;
  monthMap: CapacityMonth;
  slots: Slot[];
  t: (ko: string, en: string) => string;
  onMonthChange: (ym: string) => void;
  onRefresh: () => void;
}) {
  const [cursor, setCursor] = useState(new Date(form.date));
  const cal = useMemo(() => buildCalendar(cursor), [cursor]);
  const todayKey = ymdKey(new Date());
  const selectedKey = ymdKey(form.date);

  useEffect(() => {
    onMonthChange(`${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`);
  }, [cursor, onMonthChange]);

  return (
    <section className="space-y-4">
      <Card title={t("일자 선택", "Select a date")}>
        <div className="flex items-center justify-between mb-3">
          <button className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50" onClick={() => setCursor(addMonths(cursor, -1))}>
            이전달
          </button>
          <div className="text-sm font-semibold">
            {cursor.getFullYear()} 년 {cursor.getMonth() + 1}월
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50"
              onClick={() => setCursor(addMonths(cursor, 1))}
            >
              다음달
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              onClick={onRefresh}
              title="관리자 변경 즉시 반영"
            >
              새로고침
            </button>
          </div>
        </div>

        <div className="text-[12px] text-slate-500 mb-2">[가능] 날짜를 누르면 시간 선택이 활성화됩니다.</div>

        <div className="grid grid-cols-7 text-[11px] text-center text-slate-500 mb-1">
          {"일월화수목금토".split("").map((d: string) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cal.map((d, i) => {
            if (!d.inMonth) return <div key={i} className="aspect-square" />;
            const key = ymdKey(d.date);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;

            const status: "OPEN" | "CLOSED" = monthMap[key] || "OPEN";
            const disabled = status === "CLOSED";

            const clsBadge =
              isSelected
                ? "bg-[#2457ff] text-white border-[#2457ff]"
                : status === "OPEN"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-rose-50 text-rose-600 border-rose-200";

            return (
              <button
                key={i}
                onClick={() => !disabled && setForm((f: any) => ({ ...f, date: d.date, time: "" }))} // 시간 초기화
                className={cx(
                  "aspect-square rounded-2xl border relative flex flex-col items-center justify-center transition",
                  "text-sm",
                  "bg-white border-slate-200",
                  isToday && "ring-1 ring-blue-200",
                  isSelected && "border-[#2457ff] bg-[#eff3ff]",
                  disabled && "opacity-60 pointer-events-none"
                )}
              >
                <div className="text-[12px] mb-1 leading-none">{d.date.getDate()}</div>
                <span className={cx("px-1.5 py-[2px] rounded-full text-[10px] border", clsBadge)}>
                  {isSelected ? "선택" : status === "OPEN" ? "가능" : "마감"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title={t("시간 선택", "Select time")}>
        {form.date ? (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const st = String(s.status || "").toUpperCase() as Slot["status"];
              const active = form.time === s.time;
              return (
                <button
                  key={s.time}
                  onClick={() => st === "OPEN" && setForm((f: any) => ({ ...f, time: s.time }))}
                  className={cx(
                    "h-10 rounded-xl border text-sm",
                    st !== "OPEN" && (st === "FULL" ? "bg-amber-50 border-amber-200 text-amber-700 pointer-events-none" : "bg-slate-50 border-slate-100 text-slate-400 pointer-events-none"),
                    st === "OPEN" && !active && "bg-white border-slate-200 hover:bg-slate-50",
                    active && "bg-[#2457ff] text-white border-[#2457ff]"
                  )}
                  title={st === "OPEN" ? "OPEN" : st === "FULL" ? "FULL" : "CLOSED"}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[13px] text-slate-500">먼저 희망 일자를 선택하세요.</div>
        )}
      </Card>
    </section>
  );
}

/* ====================================================================== */
/* Card/Field/Row */
/* ====================================================================== */
function Card({ title, caption, children }: { title?: string; caption?: string; children: React.ReactNode }) {
  return (
    <section className={cx("rounded-3xl p-5 md:p-6 shadow-sm", tone.card, tone.line)}>
      {(title || caption) && (
        <header className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {caption && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{caption}</span>}
        </header>
      )}
      {children}
    </section>
  );
}
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="mb-1 text-[12px] font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}
const inputClass = cx(
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm",
  "placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-200 focus:border-slate-300"
);
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-b-0">
      <div className="text-[13px] text-slate-500">{k}</div>
      <div className="text-sm font-medium text-right ml-4 truncate max-w-[70%]">{v}</div>
    </div>
  );
}

/* ====================================================================== */
/* data fetch (no-cache + abort 지원) */
/* ====================================================================== */
async function fetchPackage(tenant: string, packageId: string, corpCode?: string): Promise<PackagePayload> {
  const u = `/api/public/${tenant}/package?` + new URLSearchParams({ id: packageId }).toString();
  try {
    const r = await fetch(noStoreUrl(u), { cache: "no-store", headers: { accept: "application/json" } });
    if (r.ok) {
      const j = await r.json();
      return {
        id: j.id,
        name: j.name ?? j.title ?? "",
        title: j.title,
        price: j.price ?? j.priceKRW ?? null,
        basicExams: j.basicExams ?? j.baseExams ?? [],
        optionGroups: j.optionGroups ?? [],
      };
    }
  } catch {}
  const urls = [
    `/api/public/${tenant}/packages?cat=general`,
    corpCode ? `/api/public/${tenant}/packages?cat=corp&code=${encodeURIComponent(corpCode)}` : null,
  ].filter(Boolean) as string[];
  const lists = await Promise.all(
    urls.map((u) =>
      fetch(noStoreUrl(u), { cache: "no-store", headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    )
  );
  const item = lists.flat().find((x: any) => x.id === packageId);
  if (!item) throw new Error("package not found");
  return {
    id: item.id,
    name: item.title ?? item.name ?? "",
    title: item.title,
    price: item.price ?? null,
    basicExams: item.basicExams ?? item.baseExams ?? [],
    optionGroups: item.optionGroups ?? [],
  };
}

async function fetchAddons(tenant: string): Promise<Addon[]> {
  try {
    const r = await fetch(noStoreUrl(`/api/public/${tenant}/addons`), { cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    const arr: any[] = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
    return arr
      .filter((x) => x?.visible !== false)
      .map((x) => ({
        id: x.id || x.code || x.examId || String(Math.random()),
        name: x.name || "",
        code: typeof x.code === "string" ? x.code.trim() : null,
        price: x.price ?? x.priceKRW ?? null,
        sex: x.sex ?? x.gender ?? x.sexNormalized ?? null,
        visible: x.visible !== false,
      }));
  } catch {
    return [];
  }
}

/* 검사 카탈로그: 이름→코드 */
async function fetchExamCatalog(tenant: string): Promise<ExamCatalogMap> {
  // 우선 /catalog/exams 시도, 실패 시 /exams 폴백
  const tryUrls = [`/api/public/${tenant}/catalog/exams`, `/api/public/${tenant}/exams`];
  for (const u of tryUrls) {
    try {
      const r = await fetch(noStoreUrl(u), { cache: "no-store", headers: { accept: "application/json" } });
      if (!r.ok) continue;
      const j = await r.json();
      const arr: Array<{ name?: string; code?: string }> = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
      const map: ExamCatalogMap = {};
      for (const x of arr) {
        const nameKey = normName(x?.name);
        const code = (x?.code || "").trim();
        if (nameKey && isValidExamCode(code)) map[nameKey] = code;
      }
      if (Object.keys(map).length > 0) return map;
    } catch {}
  }
  return {};
}

/* 사용자 기준 월 상태 조회 */
async function fetchCapacityMonthSmart(
  tenant: string,
  ym: string,
  flags: { needEGD: boolean; needCol: boolean },
  signal?: AbortSignal
): Promise<CapacityMonth> {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const last = new Date(y, m, 0).getDate();
  const from = `${yStr}-${pad2(m)}-01`;
  const to = `${yStr}-${pad2(m)}-${pad2(last)}`;

  if (!flags.needEGD && !flags.needCol) {
    const url = `/api/public/${tenant}/capacity?month=${yStr}-${pad2(m)}`;
    // 월 단위는 브라우저 캐시/ETag 활용: cache 옵션 생략
    const res = await fetch(url, { headers: { accept: "application/json" }, signal });
    if (!res.ok) throw new Error("capacity error");
    const j = await res.json();
    const raw: any = j?.days ?? j;
    const out: CapacityMonth = {};
    for (const [k, v] of Object.entries(raw || {})) out[k] = String(v).toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN";
    return out;
  }

  const resKeys = ["basic"].concat(flags.needEGD ? ["egd"] : []).concat(flags.needCol ? ["col"] : []);
  const url = `/api/public/${tenant}/capacity?` + new URLSearchParams({ from, to, resources: resKeys.join(",") }).toString();
  const r = await fetch(url, { cache: "no-store", headers: { accept: "application/json" }, signal });
  if (!r.ok) throw new Error("capacity detail error");
  const jd = await r.json();
  const days = (jd?.days || {}) as Record<string, Partial<Record<string, { cap: number; used: number; closed?: boolean }>>>;
  const out: CapacityMonth = {};
  for (const k of Object.keys(days)) {
    const d = days[k] || {};
    const basicClosed = Boolean((d as any).basic?.closed);
    const egdClosed = Boolean((d as any).egd?.closed);
    const colClosed = Boolean((d as any).col?.closed) || Boolean((d as any).cscope?.closed);
    const closed = basicClosed || (flags.needEGD && egdClosed) || (flags.needCol && colClosed);
    out[k] = closed ? "CLOSED" : "OPEN";
  }
  return out;
}

async function fetchSlots(tenant: string, ymd: string, signal?: AbortSignal): Promise<Slot[]> {
  const urls = [`/api/public/${tenant}/timeslots?date=${ymd}`, `/api/public/${tenant}/capacity?date=${ymd}`];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store", headers: { accept: "application/json" }, signal });
      if (!r.ok) continue;
      const j = await r.json();
      const raw: any[] = Array.isArray(j?.slots) ? j.slots : Array.isArray(j?.times) ? j.times : Array.isArray(j) ? j : [];
      const mapped: Slot[] = raw
        .map((s: any) => {
          const time = s?.time || s?.hhmm || s?.start || (typeof s === "string" ? s : "");
          const status: Slot["status"] = s?.status ? (String(s.status).toUpperCase() as any) : s?.available === false ? "FULL" : "OPEN";
          return { time, status };
        })
        .filter((x) => typeof x.time === "string" && /^\d{2}:\d{2}$/.test(x.time));
      if (mapped.length > 0) {
        mapped.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
        return mapped;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return [];
    }
  }
  return generateSlots();
}
function generateSlots(): Slot[] {
  const out: Slot[] = [];
  for (let m = 7 * 60; m <= 10 * 60; m += 30) {
    const hh = pad2(Math.floor(m / 60));
    const mm = pad2(m % 60);
    out.push({ time: `${hh}:${mm}`, status: "OPEN" });
  }
  return out;
}

function makeIdemKey() {
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
async function createBooking(payload: any): Promise<{ ok: boolean; msg?: string }> {
  try {
    const key = makeIdemKey();
    const res = await fetch(`/api/public/${payload.tenant}/booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}));
      const code = (j && (j.code as string)) || "";
      if (code === "FULL") return { ok: false, msg: "해당 시간은 만석입니다." };
      if (code === "CLOSED") return { ok: false, msg: "선택하신 날짜는 마감되었습니다." };
      return { ok: false, msg: "예약이 불가합니다." };
    }
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/* 이름→코드 조회 유틸 */
function codeByName(catalog: ExamCatalogMap, name?: string | null, fallback?: string | null) {
  const fromItem = (fallback || "").trim();
  if (isValidExamCode(fromItem)) return fromItem;
  const key = normName(name);
  const fromCatalog = (catalog[key] || "").trim();
  return isValidExamCode(fromCatalog) ? fromCatalog : "";
}

/* buildBookingPayload: 코드 합성 */
function buildBookingPayload(
  tenant: string,
  packageId: string,
  pkg: PackagePayload | null,
  form: any,
  corp?: { corpCode?: string; corpName?: string },
  addonsCatalog?: Array<{ id: string; name: string; code?: string | null; price?: number | null }>,
  catalogMap: ExamCatalogMap = {}
) {
  const groupsSnap = (pkg?.optionGroups || []).map((g, gi) => {
    const gid = groupIdOf(g, gi);
    const picked = new Set(form?.examSelected?.[gid] || []);
    const selected = (g.items || [])
      .map((it, xi) => ({
        key: itemKeyFrom(it, xi),
        name: it?.name || "",
        code: codeByName(catalogMap, it?.name, (it as any)?.code),
      }))
      .filter((x) => picked.has(x.key))
      .map((x) => ({ name: x.name, code: x.code }));
    return { id: gid, label: g?.label || "", selected };
  });

  const labelJoin = (rx: RegExp) => groupsSnap.find((g) => rx.test(g.label))?.selected.map((s) => s.name).filter(Boolean).join(",") || "";
  const selectedA = labelJoin(/A/i);
  const selectedB = labelJoin(/B/i);

  type AddonObj = { id: string; name: string; code: string; price: number };
  const addonObjects: AddonObj[] =
    (form?.selectedAddons || []).map((id: string) => {
      const found = (addonsCatalog || []).find((a) => a.id === id);
      return {
        id,
        name: (found?.name || id) as string,
        code: codeByName(catalogMap, found?.name, found?.code || null),
        price: Number(found?.price ?? 0) || 0,
      };
    }) ?? [];

  const basicCodes = (pkg?.basicExams || [])
    .map((nm) => codeByName(catalogMap, nm, null))
    .filter(isValidExamCode);

  const codesFromGroups = groupsSnap.flatMap((g) => g.selected.map((s) => s.code)).filter(isValidExamCode);
  const codesFromAddons = addonObjects.map((a) => a.code).filter(isValidExamCode);

  const examCodes = Array.from(new Set([...basicCodes, ...codesFromGroups, ...codesFromAddons]));
  const examCodesStr = examCodes.join(",");

  const basePrice = Number(pkg?.price) || 0;
  const addonKRW = addonObjects.reduce((s: number, a: AddonObj) => s + a.price, 0);
  const coPayKRW = basePrice + addonKRW;

  return {
    tenant,
    packageId,
    packageName: pkg?.name ?? pkg?.title ?? "",
    foreigner: !!form.foreigner,
    name: form.name,
    birth: form.birth7,
    sex: form.sex,
    phone: form.phone.replace(/\D/g, ""),
    email: form.email,
    meds: form.meds,
    disease: form.disease,
    address: { postal: form.postal, address1: form.address1, address2: form.address2 },

    exams: { basic: pkg?.basicExams || [], optional: form.examSelected || {} },

    examSnapshot: {
      groups: groupsSnap,
      selectedA,
      selectedB,
      examCodes: examCodesStr,
      addonCodes: addonObjects.map((a) => a.code).filter(isValidExamCode),
      addons: addonObjects.map((a) => a.name),
      addonIds: (form?.selectedAddons || []),
    },

    meta: {
      corpCode: corp?.corpCode || "",
      corpName: corp?.corpName || "",
      addons: addonObjects,
      priceBaseKRW: basePrice,
      coPayAddonsKRW: addonKRW,
      coPayKRW,
      totalKRW: coPayKRW,
      examCodes: examCodesStr, // 백업 저장
    },

    coPayKRW,
    totalKRW: coPayKRW,
    datetime: `${ymdKey(form.date)} ${form.time}`,
    status: "PENDING",
    survey: form.survey || {},
  };
}






