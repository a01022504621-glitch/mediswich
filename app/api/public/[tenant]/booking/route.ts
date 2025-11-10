export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";
import { pickEffectiveDate } from "@/lib/services/booking-effective-date";

/* ── 간단 레이트리밋: 10분 15회/IP */
type RLState = { c: number; t: number };
const RL: Map<string, RLState> =
  (globalThis as any).__medis_rl__ ?? ((globalThis as any).__medis_rl__ = new Map());
function allow(ip: string, limit = 15, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const cur = RL.get(ip) ?? { c: 0, t: now };
  if (now - cur.t > windowMs) {
    cur.c = 0;
    cur.t = now;
  }
  cur.c += 1;
  RL.set(ip, cur);
  return cur.c <= limit;
}

type YMD = `${number}-${number}-${number}`;
const toYMD = (d: Date): YMD =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}` as YMD;

const parseYMD_HHMM = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
  const hh = +m[4];
  const mm = +m[5];
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { date: d, hhmm: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
};

const inferSex = (v?: string | null): "M" | "F" | null => {
  const s = String(v ?? "").toUpperCase();
  if (s === "M" || s === "MALE" || s === "남" || s === "남성") return "M";
  if (s === "F" || s === "FEMALE" || s === "여" || s === "여성") return "F";
  return null;
};

/** 추가검사 입력 스키마 허용: string | {id?, name?, priceKRW?} */
type AddonIn = string | { id?: string; name?: string; priceKRW?: number };

/** 소문자/트림 정규화 */
const norm = (s: any) => String(s ?? "").trim();

/** 병원/고객사 기준으로 추가검사 가격 해석 */
async function resolveAddons(
  hospitalId: string,
  clientId: string | null,
  addonsIn: AddonIn[]
) {
  if (!Array.isArray(addonsIn) || addonsIn.length === 0)
    return { items: [] as Array<{ id?: string; name: string; priceKRW?: number }>, total: 0 };

  const ids = new Set<string>();
  const names = new Set<string>();
  for (const a of addonsIn) {
    if (typeof a === "string") {
      const v = norm(a);
      if (!v) continue;
      if (v.startsWith("cm") || v.length > 20) ids.add(v);
      else names.add(v);
    } else if (a && (a.id || a.name)) {
      if (a.id) ids.add(norm(a.id));
      if (a.name) names.add(norm(a.name));
    }
  }

  const base = await prisma.addonItem.findMany({
    where: {
      hospitalId,
      OR: [
        ids.size ? { id: { in: Array.from(ids) } } : undefined,
        names.size ? { name: { in: Array.from(names) } } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true, name: true, priceKRW: true },
  });

  let overrides: Array<{ addonItemId: string; priceKRW: number | null; enabled: boolean }> = [];
  if (clientId && base.length) {
    overrides = await prisma.addonItemClient.findMany({
      where: { clientId, addonItemId: { in: base.map((b) => b.id) } },
      select: { addonItemId: true, priceKRW: true, enabled: true },
    });
  }
  const ovMap = new Map(overrides.map((o) => [o.addonItemId, o]));

  const items = base
    .filter((b) => {
      const ov = ovMap.get(b.id);
      if (!ov) return true;
      return ov.enabled !== false;
    })
    .map((b) => {
      const ov = ovMap.get(b.id);
      const priceKRW = typeof ov?.priceKRW === "number" ? ov!.priceKRW! : b.priceKRW || 0;
      return { id: b.id, name: b.name, priceKRW };
    });

  const total = items.reduce((sum, it) => sum + (Number(it.priceKRW) || 0), 0);
  return { items, total };
}

async function findClosedDates(hospitalId: string, fromStart: Date, toNextStart: Date) {
  const closed = new Set<YMD>();
  const p: any = prisma as any;
  const candidates = [
    ["slotException", { date: true }],
    ["capacityOverride", { date: true, isClosed: true, type: true }],
    ["calendarClose", { date: true }],
    ["holiday", { date: true, closed: true }],
    ["dayClose", { date: true }],
  ] as const;

  for (const [model, select] of candidates) {
    try {
      const repo = p?.[model];
      if (!repo?.findMany) continue;
      const rows = await repo.findMany({
        where: { hospitalId, date: { gte: fromStart, lt: toNextStart } },
        select,
      });
      for (const r of rows || []) {
        if (typeof (r as any)?.isClosed === "boolean" && !(r as any).isClosed) continue;
        closed.add(toYMD((r as any).date));
      }
    } catch {}
  }
  return closed;
}

const categoryToLabel = (cat?: string | null) => {
  const u = String(cat || "").toUpperCase();
  if (u === "NHIS") return "공단검진";
  if (u === "CORP") return "기업/단체";
  return "종합검진";
};

export async function POST(req: NextRequest, context: { params: { tenant: string } }) {
  try {
    const { params } = context;
    const t = await resolveTenantHybrid({
      slug: params.tenant,
      host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
    });
    if (!t) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
    const hospitalId = t.id;

    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";
    if (!allow(ip)) {
      return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "600" } });
    }
    await new Promise((r) => setTimeout(r, 300));

    const body = await req.json();
    const {
      packageId,
      packageName,
      name,
      phone,
      birth,
      sex,
      datetime,
      email,
      address,
      foreigner,
      exams,
      survey,
      status,
      examSnapshot,
      examType,
      totalKRW,
      companySupportKRW,
      coPayKRW,
      corpName,
      corp,
      grade,
      specialExam,
      specialMaterial,
      healthCert,
      addons: addonsInRaw,
      meds,
      disease,
    } = body || {};

    if (!packageId || !name || !phone || !datetime) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const pkg = await runAs(hospitalId, () =>
      prisma.package.findFirst({
        where: { id: packageId, hospitalId: hospitalId, visible: true },
        select: { id: true, title: true, price: true, category: true, clientId: true },
      })
    );
    if (!pkg) return NextResponse.json({ error: "package not found" }, { status: 404 });

    const dt = parseYMD_HHMM(String(datetime));
    if (!dt) return NextResponse.json({ error: "invalid datetime" }, { status: 400 });

    const dayStart = new Date(dt.date.getFullYear(), dt.date.getMonth(), dt.date.getDate(), 0, 0, 0, 0);
    const nextStart = new Date(dt.date.getFullYear(), dt.date.getMonth(), dt.date.getDate() + 1, 0, 0, 0, 0);

    const closedMap = await runAs(hospitalId, () => findClosedDates(hospitalId, dayStart, nextStart));
    if (closedMap.has(toYMD(dayStart))) {
      return NextResponse.json({ error: "closed", code: "CLOSED" }, { status: 409 });
    }

    const dow = dayStart.getDay();
    const templates = await runAs(hospitalId, () =>
      prisma.slotTemplate.findMany({
        where: { hospitalId: hospitalId, dow },
        select: { start: true, end: true, capacity: true },
        orderBy: { start: "asc" },
      })
    );
    const within = (hhmm: string, start: string, end: string) => start <= hhmm && hhmm <= end;
    let capForSlot = 0;
    for (const t of templates) if (within(dt.hhmm, t.start, t.end)) capForSlot = Math.max(capForSlot, t.capacity || 0);
    if (capForSlot === 0) capForSlot = 999;

    const activeStatuses = ["PENDING", "RESERVED", "CONFIRMED"] as const;
    const used = await runAs(hospitalId, () =>
      prisma.booking.count({
        where: {
          hospitalId: hospitalId,
          date: { gte: dayStart, lt: nextStart },
          time: dt.hhmm,
          status: { in: activeStatuses as any },
        },
      })
    );
    if (used >= capForSlot) {
      return NextResponse.json({ error: "full", code: "FULL" }, { status: 409 });
    }

    const phoneDigits = String(phone).replace(/\D/g, "");
    const sexEnum = inferSex(sex);
    const pkgPrice = Number(pkg.price ?? 0) || 0;

    const metaIn = body && typeof body.meta === "object" && body.meta ? body.meta : {};
    const corpCodeIn: string = String(body.corpCode ?? metaIn.corpCode ?? "").trim();
    let corpNameFinal: string | null = String(corpName ?? corp ?? metaIn.corpName ?? "").trim() || null;
    let corpCodeFinal: string | null = corpCodeIn || null;
    let clientIdFinal: string | null = null;

    if (corpCodeIn) {
      const client = await runAs(hospitalId, () =>
        prisma.client.findFirst({
          where: { hospitalId: hospitalId, code: { equals: corpCodeIn, mode: "insensitive" } },
          select: { id: true, name: true, code: true },
        })
      );
      if (client) {
        corpNameFinal = client.name || corpNameFinal;
        corpCodeFinal = client.code || corpCodeFinal;
        clientIdFinal = client.id;
      }
    }
    if (!corpNameFinal && pkg.clientId) {
      const client = await runAs(hospitalId, () =>
        prisma.client.findFirst({
          where: { id: pkg.clientId ?? undefined, hospitalId },
          select: { id: true, name: true, code: true },
        })
      );
      if (client) {
        corpNameFinal = client.name || null;
        corpCodeFinal = client.code || corpCodeFinal;
        clientIdFinal = client.id;
      }
    }

    const snapIn = examSnapshot ?? {};

    // ---- 여기부터: never[]/concat 문제 제거용 정규화 ----
    const fromPayload: AddonIn[] = Array.isArray(addonsInRaw) ? (addonsInRaw as AddonIn[]) : [];
    const fromMeta: AddonIn[] = Array.isArray(metaIn?.addons) ? (metaIn.addons as AddonIn[]) : [];
    const fromSnapIds: AddonIn[] = Array.isArray(snapIn?.addonIds)
      ? (snapIn.addonIds as any[]).map((id) => String(id))
      : [];
    const fromSnapNames: AddonIn[] = Array.isArray(snapIn?.addons)
      ? (snapIn.addons as any[]).map((name) => String(name))
      : [];

    const addonsMerged: AddonIn[] = [
      ...fromPayload,
      ...fromMeta,
      ...fromSnapIds,
      ...fromSnapNames,
    ];
    // ---------------------------------------------------

    const { items: addonItems, total: addonsTotal } = addonsMerged.length
      ? await runAs(hospitalId, () => resolveAddons(hospitalId, clientIdFinal, addonsMerged))
      : { items: [] as Array<{ id?: string; name: string; priceKRW?: number }>, total: 0 };

    const fallbackAddonNames: string[] = (() => {
      const names: string[] = [];
      if (Array.isArray(snapIn?.addons)) names.push(...(snapIn.addons as any[]).map(norm));
      if (Array.isArray(metaIn?.addons)) {
        names.push(
          ...(metaIn.addons as any[]).map((x: any) =>
            typeof x === "string" ? norm(x) : norm(x?.name || x?.title || x?.id)
          )
        );
      }
      if (Array.isArray(addonsMerged)) {
        names.push(
          ...addonsMerged
            .filter((v: any) => typeof v === "string")
            .map((v: any) => norm(v))
        );
      }
      return Array.from(new Set(names.filter(Boolean)));
    })();

    const totalReq = Number(totalKRW ?? NaN);
    const supportReq = Number(companySupportKRW ?? NaN);
    const copayReq = Number(coPayKRW ?? NaN);

    const total = Number.isFinite(totalReq) ? totalReq : Number(pkgPrice) + Number(addonsTotal || 0);
    const support = Number.isFinite(supportReq) ? supportReq : 0;
    const copay = Number.isFinite(copayReq) ? copayReq : Math.max(0, total - support);

    const examTypeLabel = String(examType || categoryToLabel(pkg.category));

    const groups = Array.isArray(snapIn?.groups) ? (snapIn.groups as any[]) : [];
    const snap = {
      groups: groups.map((g: any) => ({
        id: g?.id ?? g?.gid ?? g?.label ?? "",
        label: String(g?.label || ""),
        selected: Array.isArray(g?.selected)
          ? g.selected.map((s: any) => ({
              name: String(s?.name || ""),
              code: String(s?.code || ""),
            }))
          : [],
      })),
      selectedA: (snapIn as any)?.selectedA || "",
      selectedB: (snapIn as any)?.selectedB || "",
      examCodes: (snapIn as any)?.examCodes || "",
      addons: Array.isArray((snapIn as any)?.addons) ? (snapIn as any).addons : [],
      addonIds: Array.isArray((snapIn as any)?.addonIds) ? (snapIn as any).addonIds : [],
    };

    const addonsForMeta = addonItems.length
      ? addonItems
      : fallbackAddonNames.map((n) => ({ name: n, priceKRW: 0 }));

    const addonsTotalForMeta = addonItems.length ? addonsTotal : 0;

    const metaOut: any = {
      ...(metaIn || {}),
      foreigner: !!foreigner,
      email: email || null,
      address: address || null,
      exams: exams || null,
      survey: survey || null,
      meds: (typeof metaIn?.meds !== "undefined" ? metaIn.meds : meds) ?? null,
      disease: (typeof metaIn?.disease !== "undefined" ? metaIn.disease : disease) ?? null,

      packageName: packageName || pkg.title || null,
      source: "public" as const,
      examSnapshot: snap,
      examType: examTypeLabel,

      totalKRW: total,
      companySupportKRW: support,
      coPayKRW: copay,
      packageCategory: pkg.category || null,
      packageCategoryLabel: examTypeLabel,

      corpName: corpNameFinal,
      corpCode: corpCodeFinal,
      clientId: clientIdFinal,
      grade: grade ?? metaIn.grade ?? null,
      specialExam: specialExam ?? metaIn.specialExam ?? null,
      specialMaterial: specialMaterial ?? metaIn.specialMaterial ?? null,
      healthCert: !!healthCert || !!metaIn.healthCert || false,

      addons: addonsForMeta,
      addonsTotalKRW: addonsTotalForMeta,
    };

    const eff = pickEffectiveDate({ date: dayStart, meta: metaOut });
    metaOut.effectiveDate = toYMD(eff);

    const idem = (req.headers.get("idempotency-key") || "").slice(0, 64);
    if (idem) {
      const exist = await runAs(hospitalId, () =>
        prisma.booking.findFirst({
          where: { hospitalId: hospitalId, idempotencyKey: idem },
          select: { id: true, code: true },
        })
      );
      if (exist) {
        return NextResponse.json(
          { ok: true, id: exist.id, code: exist.code },
          { status: 200, headers: { "cache-control": "no-store" } }
        );
      }
    }

    const created = await runAs(hospitalId, () =>
      prisma.booking.create({
        data: {
          hospitalId: hospitalId,
          packageId: pkg.id,
          date: dayStart,
          time: dt.hhmm,
          name: String(name),
          phone: String(phone),
          phoneNormalized: phoneDigits || null,
          patientBirth: birth ? String(birth) : null,
          sex: sexEnum as any,
          status: ((): any => {
            const s = String(status || "").toUpperCase();
            if (s === "REQUESTED") return "PENDING";
            if (["PENDING", "RESERVED", "CONFIRMED"].includes(s)) return s;
            return "PENDING";
          })(),
          meta: metaOut,
          idempotencyKey: idem || null,
        },
        select: { id: true, code: true },
      })
    );

    return NextResponse.json(
      { ok: true, id: created.id, code: created.code },
      { status: 201, headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}





