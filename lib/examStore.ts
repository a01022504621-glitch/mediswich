// lib/examStore.ts
// 로컬 캐시 + 서버 동기화 유틸
// 증식 방지: 퍼블리시 단일 락, 선삭제-단건생성 폴백

type Ns = "nhis" | "general" | "corp";
type SexCode = "A" | "M" | "F";

const NS_ALL: Ns[] = ["nhis", "general", "corp"];
const OVERRIDE_API = "/api/m/exams/overrides";

/* ---------------- hospital scope ---------------- */
async function getHospitalScope(): Promise<{ id?: string; slug?: string }> {
  try {
    const r = await fetch("/api/m/org/self", { cache: "no-store" });
    const j = await r.json();
    const id = j?.hospital?.id || j?.id;
    const slug = j?.hospital?.slug || j?.slug;
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("ms:lastHid", id);
      if (slug) localStorage.setItem("ms:lastHslug", slug);
    }
    return { id, slug };
  } catch {
    if (typeof window !== "undefined") {
      return {
        id: localStorage.getItem("ms:lastHid") || undefined,
        slug: localStorage.getItem("ms:lastHslug") || undefined,
      };
    }
    return {};
  }
}
export async function ensureHospitalScope() {
  await getHospitalScope();
}
function hidFromCache() {
  if (typeof window === "undefined") return "anon";
  return localStorage.getItem("ms:lastHid") || "anon";
}

/* ---------------- keys ---------------- */
const PKG_PREFIX = "ms:pkg";
const CODE_PREFIX = "ms:codes";
const SEX_PREFIX  = "ms:sex";
const keyOf = (prefix: string, ns: Ns, hid = hidFromCache()) => `${prefix}:${ns}:${hid}`;

/* ---------------- clear helpers ---------------- */
export function clearLocal(ns?: Ns) {
  if (typeof window === "undefined") return;
  const targets: Ns[] = ns ? [ns] : NS_ALL;
  targets.forEach((k) => {
    localStorage.removeItem(keyOf(PKG_PREFIX, k));
    localStorage.removeItem(keyOf(CODE_PREFIX, k));
    localStorage.removeItem(keyOf(SEX_PREFIX, k));
  });
}

/* ---------------- server overrides ---------------- */
type OverrideMap = {
  [examId: string]: { code?: string; sex?: SexCode };
};

async function fetchOverrides(): Promise<OverrideMap | null> {
  try {
    const r = await fetch(OVERRIDE_API, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const map = (j?.map || j) as OverrideMap;
    if (!map || typeof map !== "object") return null;
    return map;
  } catch {
    return null;
  }
}

async function pushOverrides(updates: Array<{ examId: string; code?: string; sex?: SexCode }>) {
  try {
    await fetch(OVERRIDE_API, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ updates }),
    });
  } catch {
    /* no-op: 서버 미구현 시 로컬만 유지 */
  }
}

/* ---------------- codes (local with server sync) ---------------- */
export function loadCodes(ns?: Ns) {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(keyOf(CODE_PREFIX, (ns || "general") as Ns));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const isObj = parsed && typeof parsed === "object" && !Array.isArray(parsed);
    return isObj ? parsed : {};
  } catch {
    return {};
  }
}
export function saveCodes(map: Record<string, string>, ns?: Ns) {
  if (typeof window === "undefined") return;
  const safe = map && typeof map === "object" && !Array.isArray(map) ? map : {};
  const key = keyOf(CODE_PREFIX, (ns || "general") as Ns);
  if (Object.keys(safe).length === 0) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(safe));
}
function writeCodeAllNamespaces(examId: string, code: string) {
  if (typeof window === "undefined") return;
  NS_ALL.forEach((ns) => {
    const cur = loadCodes(ns);
    const next = { ...cur, [examId]: code };
    saveCodes(next, ns);
  });
}
export async function upsertCode(examId: string, code: string, ns?: Ns) {
  writeCodeAllNamespaces(examId, code);
  // 서버 전역 오버라이드 업서트
  await pushOverrides([{ examId, code }]);
  // 호출자 호환 반환
  const cur = loadCodes(ns);
  const next = { ...cur, [examId]: code };
  saveCodes(next, ns);
  return next;
}

/* ---------------- sex (local with server sync) ---------------- */
export function loadSex(ns?: Ns) {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(keyOf(SEX_PREFIX, (ns || "general") as Ns));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const isObj = parsed && typeof parsed === "object" && !Array.isArray(parsed);
    return isObj ? parsed : {};
  } catch {
    return {};
  }
}
export function saveSex(map: Record<string, SexCode>, ns?: Ns) {
  if (typeof window === "undefined") return;
  const safe = map && typeof map === "object" && !Array.isArray(map) ? map : {};
  const key = keyOf(SEX_PREFIX, (ns || "general") as Ns);
  if (Object.keys(safe).length === 0) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(safe));
}
function writeSexAllNamespaces(examId: string, sex: SexCode) {
  if (typeof window === "undefined") return;
  NS_ALL.forEach((ns) => {
    const cur = loadSex(ns);
    const next = { ...cur, [examId]: sex };
    saveSex(next, ns);
  });
}
export async function upsertSex(examId: string, sex: SexCode, ns?: Ns) {
  writeSexAllNamespaces(examId, sex);
  await pushOverrides([{ examId, sex }]);
  const cur = loadSex(ns);
  const next = { ...cur, [examId]: sex };
  saveSex(next, ns);
  return next;
}

/** 서버 → 로컬 캐시 동기화(선택 호출) */
export async function refreshOverridesToLocal() {
  const map = await fetchOverrides();
  if (!map || typeof window === "undefined") return;
  const codeMap: Record<string, string> = {};
  const sexMap: Record<string, SexCode> = {};
  Object.entries(map).forEach(([examId, v]) => {
    if (v?.code) codeMap[examId] = v.code;
    if (v?.sex) sexMap[examId] = v.sex;
  });
  NS_ALL.forEach((ns) => {
    if (Object.keys(codeMap).length) saveCodes(codeMap, ns);
    if (Object.keys(sexMap).length) saveSex(sexMap, ns);
  });
}

/* ---------------- local drafts ---------------- */
export function loadPackages(ns: Ns) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyOf(PKG_PREFIX, ns));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as any[];
    // 자동 치유
    localStorage.removeItem(keyOf(PKG_PREFIX, ns));
    return [];
  } catch {
    return [];
  }
}
export function savePackages(ns: Ns, list: any[]) {
  if (typeof window === "undefined") return;
  const key = keyOf(PKG_PREFIX, ns);
  if (!Array.isArray(list) || list.length === 0) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(list));
}

/* ===== 변환 ===== */
function groupLabelDefault(gid: string) {
  if (gid === "base") return "기본검사";
  const token = gid.startsWith("opt_") ? gid.replace("opt_", "") : gid;
  return `선택검사 ${token}`;
}
function rowsToValues(rows: any[]) {
  return (rows || []).map((r) => ({
    id: r.examId,
    name: r.name ?? "",
    sex: r.sex ?? "A",
    memo: r.memo ?? "",
    code: r.code ?? "",
  }));
}

/** (구방식 POST용) Draft → 서버 포맷 */
function draftToServerBody(ns: Ns, p: any) {
  const groups: Record<string, any> = {};
  const inOrder: string[] = Array.isArray(p?.groupOrder) ? p.groupOrder : Object.keys(p?.groups || {});

  // NHIS: base[]만 지원
  if (ns === "nhis" && Array.isArray(p?.base)) {
    const baseVals = rowsToValues(p.base);
    groups.basic = { id: "basic", label: "기본검사", chooseCount: 0, values: baseVals };
  } else {
    for (const gid of inOrder) {
      const values = rowsToValues((p.groups || {})[gid] || []);
      const outKey = gid === "base" ? "basic" : gid; // 서버 키
      const meta = (p.groupMeta || {})[gid] || {};
      groups[outKey] = {
        id: outKey,
        label: meta.label || groupLabelDefault(gid),
        chooseCount:
          typeof meta.chooseCount === "number" ? meta.chooseCount : gid === "base" ? 0 : values.length ? 1 : 0,
        values,
      };
    }
  }

  const orderOut = ns === "nhis" ? ["basic"] : inOrder.map((gid) => (gid === "base" ? "basic" : gid));

  const tags: any = {
    groups,
    groupOrder: orderOut,
    addons: Array.isArray(p.addons) ? p.addons : [],
    period: { from: p.from || null, to: p.to || null },
  };
  if (ns === "corp" && p.billing) tags.billing = p.billing;

  return {
    title: p.name,
    price: typeof p.price === "number" ? p.price : null,
    summary: null,
    visible: !!p.showInBooking,
    tags,
  };
}

/** 서버 → Draft */
function serverToDraft(sp: any) {
  const tags = sp?.tags || {};
  const groupsIn = tags.groups || {};
  const orderIn: string[] = Array.isArray(tags.groupOrder) ? tags.groupOrder : Object.keys(groupsIn);
  const groups: Record<string, any[]> = {};
  const groupMeta: Record<string, any> = {};
  const orderOut: string[] = [];

  const toArr = (v: any): any[] =>
    Array.isArray(v) ? v : Array.isArray(v?.values) ? v.values : Array.isArray(v?.items) ? v.items : [];

  for (const k of orderIn) {
    const g = groupsIn[k] || {};
    const gid = k === "basic" ? "base" : k; // 클라 키
    orderOut.push(gid);
    groupMeta[gid] = {
      id: gid,
      label: g.label || groupLabelDefault(gid),
      color: gid === "base" ? "sky" : "slate",
      chooseCount: typeof g.chooseCount === "number" ? g.chooseCount : gid === "base" ? 0 : 1,
    };
    groups[gid] = toArr(g).map((v: any) => ({
      examId: v.id,
      name: v.name || "",
      sex: v.sex || "A",
      memo: v.memo || "",
      code: v.code || "",
    }));
  }

  const period = tags.period || {};
  const from = period.from ?? sp.startDate ?? null;
  const to = period.to ?? sp.endDate ?? null;

  return {
    id: sp.id || `pkg_${Math.random().toString(36).slice(2)}`,
    name: sp.title || "",
    from,
    to,
    price: sp.price ?? 0,
    groups,
    groupOrder: orderOut,
    groupMeta,
    addons: Array.isArray(tags.addons) ? tags.addons : [],
    showInBooking: !!sp.visible,
    clientId: sp.clientId ?? null,
    billing: tags.billing ?? undefined,
  };
}

/* ===== 서버 동기화 ===== */
function nsPath(ns: Ns) {
  return ns === "nhis" ? "nhis" : ns === "corp" ? "corp" : "general";
}
async function scopeUrl(ns: Ns, withHid = false) {
  const cat = nsPath(ns);
  const base = `/api/m/packages/${cat}`;
  if (!withHid) return base;
  const { id } = await getHospitalScope();
  return id ? `${base}?hid=${encodeURIComponent(id)}` : base;
}
function unifiedUrl(ns: Ns) {
  return `/api/m/packages/by-ns/${ns}`;
}

/** 일괄 삭제 */
async function wipeAll(ns: Ns) {
  const url = await scopeUrl(ns, true);
  await fetch(url, { method: "DELETE" });
}

/** 퍼블리시 락(증식 방지) */
const publishLocks = new Set<string>();
function keyForLock(ns: Ns) {
  return `${ns}:${hidFromCache()}`;
}

/**
 * 퍼블리시
 * 1) PUT(/by-ns/[ns])로 치환 저장
 * 2) 실패 시 DELETE → POST 반복 (증식 방지)
 */
export async function publishPackages(ns: Ns, list: any[]) {
  const lockKey = keyForLock(ns);
  if (publishLocks.has(lockKey)) return;
  publishLocks.add(lockKey);
  try {
    try {
      const r = await fetch(unifiedUrl(ns), {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ items: list }),
      });
      if (r.ok) return;
    } catch {
      /* fallthrough */
    }

    await wipeAll(ns);
    const url = await scopeUrl(ns, true);
    for (const p of list) {
      const body = draftToServerBody(ns, p);
      if (ns === "corp") (body as any).clientId = (p as any).clientId || null;
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
    }
  } finally {
    publishLocks.delete(lockKey);
  }
}

/**
 * DB 우선 조회:
 * 1) GET(/by-ns/[ns]) → {ok, items}
 * 2) (폴백) 관리자 GET(hid)
 * 3) (폴백) 퍼블릭 슬러그
 * 4) 로컬 캐시
 */
export async function loadPackagesDBFirst(ns: Ns): Promise<any[]> {
  try {
    const { id, slug } = await getHospitalScope();

    try {
      const r1 = await fetch(unifiedUrl(ns), { cache: "no-store" });
      if (r1.ok) {
        const j = await r1.json().catch(() => null as any);
        const arr = Array.isArray(j?.items) ? j.items : [];
        if (arr.length) return arr.map(serverToDraft);
      }
    } catch {}

    if (id) {
      const r2 = await fetch(`/api/m/packages/${nsPath(ns)}?hid=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (r2.ok) {
        const j = await r2.json().catch(() => null as any);
        const arr = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
        if (arr.length) return arr.map(serverToDraft);
      }
    }

    if (slug) {
      const r3 = await fetch(`/api/public/${encodeURIComponent(slug)}/packages?cat=${encodeURIComponent(ns)}`, {
        cache: "no-store",
      });
      if (r3.ok) {
        const arr = (await r3.json()) as any[];
        if (Array.isArray(arr) && arr.length) return arr.map(serverToDraft);
      }
    }

    return loadPackages(ns);
  } catch {
    return loadPackages(ns);
  }
}







