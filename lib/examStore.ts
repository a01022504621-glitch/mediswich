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
    return {
      id: localStorage.getItem("ms:lastHid") || undefined,
      slug: localStorage.getItem("ms:lastHslug") || undefined,
    };
  }
}
export async function ensureHospitalScope() { await getHospitalScope(); }

function hidFromCache() { return localStorage.getItem("ms:lastHid") || "anon"; }
const PKG_PREFIX = "ms:pkg";
const CODE_PREFIX = "ms:codes";
const keyOf = (prefix: string, ns: Ns, hid = hidFromCache()) => `${prefix}:${ns}:${hid}`;

/* ---------------- codes ---------------- */
export function loadCodes(ns?: Ns) {
  try { return JSON.parse(localStorage.getItem(keyOf(CODE_PREFIX, (ns || "general") as Ns)) || "{}"); }
  catch { return {}; }
}
export function saveCodes(map: Record<string, string>, ns?: Ns) {
  localStorage.setItem(keyOf(CODE_PREFIX, (ns || "general") as Ns), JSON.stringify(map || {}));
}
export function upsertCode(examId: string, code: string, ns?: Ns) {
  const cur = loadCodes(ns); const next = { ...cur, [examId]: code }; saveCodes(next, ns); return next;
}

/* ---------------- local drafts ---------------- */
export function loadPackages(ns: Ns) {
  try { return JSON.parse(localStorage.getItem(keyOf(PKG_PREFIX, ns)) || "[]") as any[]; }
  catch { return []; }
}
export function savePackages(ns: Ns, list: any[]) {
  localStorage.setItem(keyOf(PKG_PREFIX, ns), JSON.stringify(list || []));
}

/* ===== 변환 ===== */
function groupLabelDefault(gid: string) {
  if (gid === "base") return "기본검사";
  const token = gid.startsWith("opt_") ? gid.replace("opt_", "") : gid;
  return `선택검사 ${token}`;
}
function rowsToValues(rows: any[]) {
  return (rows || []).map((r) => ({
    id: r.examId, name: r.name ?? "", sex: r.sex ?? "A", memo: r.memo ?? "", code: r.code ?? "",
  }));
}
function draftToServerBody(ns: Ns, p: any) {
  const groups: Record<string, any> = {};
  const order: string[] = Array.isArray(p.groupOrder) ? p.groupOrder : Object.keys(p.groups || {});
  for (const gid of order) {
    const meta = (p.groupMeta || {})[gid] || {};
    const values = rowsToValues((p.groups || {})[gid] || []);
    const base = {
      id: gid,
      label: meta.label,
      chooseCount: meta.chooseCount ?? (gid === "base" ? 0 : values.length ? 1 : 0),
      values,
    };
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
function serverToDraft(sp: any) {
  const tags = sp?.tags || {};
  const groupsIn = tags.groups || {};
  const orderIn: string[] = Array.isArray(tags.groupOrder) ? tags.groupOrder : Object.keys(groupsIn);

  const groups: Record<string, any[]> = {};
  const groupMeta: Record<string, any> = {};
  const orderOut: string[] = [];

  for (const k of orderIn) {
    const g = groupsIn[k] || {};
    const gid = k === "basic" ? "base" : k;
    orderOut.push(gid);
    groupMeta[gid] = {
      id: gid,
      label: g.label || groupLabelDefault(gid),
      color: gid === "base" ? "sky" : "slate",
      chooseCount: typeof g.chooseCount === "number" ? g.chooseCount : gid === "base" ? 0 : 1,
    };
    groups[gid] = (g.values || []).map((v: any) => ({
      examId: v.id, name: v.name || "", sex: v.sex || "A", memo: v.memo || "", code: v.code || "",
    }));
  }

  const period = tags.period || {};
  const from = period.from ?? sp.startDate ?? null;
  const to = period.to ?? sp.endDate ?? null;

  return {
    id: sp.id || `pkg_${Math.random().toString(36).slice(2)}`,
    name: sp.title || "",
    from, to,
    price: sp.price ?? 0,
    groups, groupOrder: orderOut, groupMeta,
    addons: Array.isArray(tags.addons) ? tags.addons : [],
    showInBooking: !!sp.visible,
  };
}

/* ===== 서버 동기화 ===== */
async function scopeUrl(ns: Ns, withHid = false) {
  const cat = ns === "nhis" ? "nhis" : ns === "corp" ? "corp" : "general";
  const base = `/api/m/packages/${cat}`;
  if (!withHid) return base;
  const { id } = await getHospitalScope();
  return id ? `${base}?hid=${encodeURIComponent(id)}` : base;
}
async function wipeAll(ns: Ns) {
  const url = await scopeUrl(ns, true);
  await fetch(url, { method: "DELETE" });
}
export async function publishPackages(ns: Ns, list: any[]) {
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
}

/** DB 우선 조회: 1) 관리자용 GET(hid) 2) 퍼블릭 슬러그 3) 로컬 */
export async function loadPackagesDBFirst(ns: Ns): Promise<any[]> {
  try {
    const { id, slug } = await getHospitalScope();
    const cat = ns;
    // 1) 관리자용
    if (id) {
      const r = await fetch(`/api/m/packages/${cat}?hid=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (r.ok) {
        const arr = (await r.json()) as any[];
        return Array.isArray(arr) ? arr.map(serverToDraft) : [];
      }
    }
    // 2) 퍼블릭
    if (slug) {
      const r = await fetch(`/api/public/${encodeURIComponent(slug)}/packages?cat=${encodeURIComponent(cat)}`, { cache: "no-store" });
      if (r.ok) {
        const arr = (await r.json()) as any[];
        return Array.isArray(arr) ? arr.map(serverToDraft) : [];
      }
    }
    // 3) 로컬 캐시
    return loadPackages(ns);
  } catch {
    return loadPackages(ns);
  }
}



