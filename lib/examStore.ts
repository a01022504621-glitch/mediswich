// lib/examStore.ts
type Ns = "nhis" | "general" | "corp";

/* ---------------- hospital scope ---------------- */
async function getHospitalScope(): Promise<{ id?: string; slug?: string }> {
  try {
    const r = await fetch("/api/m/org/self", { cache: "no-store" });
    const j = await r.json();
    const id = j?.hospital?.id || j?.id;
    const slug = j?.hospital?.slug || j?.slug;
    if (id) localStorage.setItem("ms:lastHid", id);
    if (slug) localStorage.setItem("ms:lastHslug", slug);
    return { id, slug };
  } catch {
    return { id: localStorage.getItem("ms:lastHid") || undefined, slug: localStorage.getItem("ms:lastHslug") || undefined };
  }
}

/** 페이지 마운트 시 한 번 호출해 병원 스코프 캐싱 */
export async function ensureHospitalScope() {
  await getHospitalScope();
}

function hidFromCache() {
  return localStorage.getItem("ms:lastHid") || "anon";
}
const PKG_PREFIX = "ms:pkg";
const CODE_PREFIX = "ms:codes";
const keyOf = (prefix: string, ns: Ns, hid = hidFromCache()) => `${prefix}:${ns}:${hid}`;

/* ---------------- codes (검사코드) ---------------- */
export function loadCodes(ns?: Ns) {
  try {
    const raw = localStorage.getItem(keyOf(CODE_PREFIX, (ns || "general") as Ns)) || "{}";
    return JSON.parse(raw);
  } catch { return {}; }
}
export function saveCodes(map: Record<string, string>, ns?: Ns) {
  localStorage.setItem(keyOf(CODE_PREFIX, (ns || "general") as Ns), JSON.stringify(map || {}));
}
export function upsertCode(examId: string, code: string, ns?: Ns) {
  const cur = loadCodes(ns);
  const next = { ...cur, [examId]: code };
  saveCodes(next, ns);
  return next;
}

/* ---------------- packages (드래프트) ---------------- */
export function loadPackages(ns: Ns) {
  try {
    const raw = localStorage.getItem(keyOf(PKG_PREFIX, ns)) || "[]";
    return JSON.parse(raw) as any[];
  } catch { return []; }
}
export function savePackages(ns: Ns, list: any[]) {
  localStorage.setItem(keyOf(PKG_PREFIX, ns), JSON.stringify(list || []));
}

/* 서버로 보낼 tags 포맷 변환 */
function rowsToValues(rows: any[]) {
  return (rows || []).map(r => ({
    id: r.examId, name: r.name ?? "", sex: r.sex ?? "A", memo: r.memo ?? "", code: r.code ?? ""
  }));
}
function draftToServerBody(ns: Ns, p: any) {
  const groups: Record<string, any> = {};
  const order: string[] = Array.isArray(p.groupOrder) ? p.groupOrder : Object.keys(p.groups || {});
  for (const gid of order) {
    const meta = (p.groupMeta || {})[gid] || {};
    const values = rowsToValues((p.groups || {})[gid] || []);
    const base = { id: gid, label: meta.label, chooseCount: meta.chooseCount ?? (gid === "base" ? 0 : values.length ? 1 : 0), values };
    groups[gid === "base" ? "basic" : gid] = base;
  }
  const tags: any = {
    groups,
    groupOrder: order,
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

/* 병원 단위로 “전체 갈아끼우기” → 간단하고 안전 */
async function wipeAll(ns: Ns) {
  const url =
    ns === "general" ? "/api/m/packages/general"
    : ns === "nhis"   ? "/api/m/packages/nhis"
    :                  "/api/m/packages/corp";
  await fetch(url, { method: "DELETE" }); // corp도 병원 단위 일괄 삭제 지원
}

/** 화면에서 저장/삭제/토글 후에 호출 → 서버와 동기화 */
export async function publishPackages(ns: Ns, list: any[]) {
  await wipeAll(ns);
  const url =
    ns === "general" ? "/api/m/packages/general"
    : ns === "nhis"   ? "/api/m/packages/nhis"
    :                  "/api/m/packages/corp";
  for (const p of list) {
    const body = draftToServerBody(ns, p);
    // corp이면 clientId 포함
    if (ns === "corp") (body as any).clientId = p.clientId || null;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
  }
}


