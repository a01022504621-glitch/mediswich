// app/api/public/[tenant]/booking/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ── 간단 레이트리밋: 10분 15회/IP */
type RLState = { c: number; t: number };
const RL: Map<string, RLState> = (globalThis as any).__medis_rl__ ?? ((globalThis as any).__medis_rl__ = new Map());
function allow(ip: string, limit = 15, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const cur = RL.get(ip) ?? { c: 0, t: now };
  if (now - cur.t > windowMs) { cur.c = 0; cur.t = now; }
  cur.c += 1; RL.set(ip, cur);
  return cur.c <= limit;
}

type YMD = `${number}-${number}-${number}`;
const toYMD = (d: Date): YMD =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

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

export async function POST(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    // 레이트리밋
    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";
    if (!allow(ip)) {
      return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "600" } });
    }
    await new Promise((r) => setTimeout(r, 300)); // 봇 완화

    const body = await req.json();
    const {
      packageId, packageName, name, phone, birth, sex, datetime,
      email, address, foreigner, exams, survey, status,
      examSnapshot, examType, totalKRW, companySupportKRW, coPayKRW,
      corpName, corp, grade, specialExam, specialMaterial, healthCert,
    } = body || {};

    if (!packageId || !name || !phone || !datetime) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const hosp = await prisma.hospital.findFirst({
      where: { slug: params.tenant },
      select: { id: true },
    });
    if (!hosp) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, hospitalId: hosp.id, visible: true },
      select: { id: true, title: true, price: true, category: true, clientId: true },
    });
    if (!pkg) return NextResponse.json({ error: "package not found" }, { status: 404 });

    const dt = parseYMD_HHMM(String(datetime));
    if (!dt) return NextResponse.json({ error: "invalid datetime" }, { status: 400 });

    const dayStart = new Date(dt.date.getFullYear(), dt.date.getMonth(), dt.date.getDate(), 0, 0, 0, 0);
    const nextStart = new Date(dt.date.getFullYear(), dt.date.getMonth(), dt.date.getDate() + 1, 0, 0, 0, 0);

    // 휴무/마감
    const closedMap = await findClosedDates(hosp.id, dayStart, nextStart);
    if (closedMap.has(toYMD(dayStart))) {
      return NextResponse.json({ error: "closed", code: "CLOSED" }, { status: 409 });
    }

    // 수용 인원
    const dow = dayStart.getDay();
    const templates = await prisma.slotTemplate.findMany({
      where: { hospitalId: hosp.id, dow },
      select: { start: true, end: true, capacity: true },
      orderBy: { start: "asc" },
    });
    const within = (hhmm: string, start: string, end: string) => start <= hhmm && hhmm <= end;
    let capForSlot = 0;
    for (const t of templates) if (within(dt.hhmm, t.start, t.end)) capForSlot = Math.max(capForSlot, t.capacity || 0);
    if (capForSlot === 0) capForSlot = 999;

    const activeStatuses = ["PENDING", "RESERVED", "CONFIRMED"] as const;
    const used = await prisma.booking.count({
      where: {
        hospitalId: hosp.id,
        date: { gte: dayStart, lt: nextStart },
        time: dt.hhmm,
        status: { in: activeStatuses as any },
      },
    });
    if (used >= capForSlot) {
      return NextResponse.json({ error: "full", code: "FULL" }, { status: 409 });
    }

    // 정규화
    const phoneDigits = String(phone).replace(/\D/g, "");
    const sexEnum = inferSex(sex);
    const pkgPrice = Number(pkg.price ?? 0) || 0;
    const total = Number(totalKRW ?? pkgPrice) || 0;
    const support = Number(companySupportKRW ?? 0) || 0;
    const copay = Number(coPayKRW ?? Math.max(0, total - support)) || 0;
    const examTypeLabel = String(examType || categoryToLabel(pkg.category));

    // 고객사 메타
    const metaIn = (body && typeof body.meta === "object" && body.meta) ? body.meta : {};
    const corpCodeIn: string = String(body.corpCode ?? metaIn.corpCode ?? "").trim();
    let corpNameFinal: string | null = String(corpName ?? corp ?? metaIn.corpName ?? "").trim() || null;
    let corpCodeFinal: string | null = corpCodeIn || null;
    let clientIdFinal: string | null = null;

    if (corpCodeIn) {
      const client = await prisma.client.findFirst({
        where: { hospitalId: hosp.id, code: { equals: corpCodeIn, mode: "insensitive" } },
        select: { id: true, name: true, code: true },
      });
      if (client) {
        corpNameFinal = client.name || corpNameFinal;
        corpCodeFinal = client.code || corpCodeFinal;
        clientIdFinal = client.id;
      }
    }
    if (!corpNameFinal && pkg.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: pkg.clientId, hospitalId: hosp.id },
        select: { id: true, name: true, code: true },
      });
      if (client) {
        corpNameFinal = client.name || null;
        corpCodeFinal = client.code || corpCodeFinal;
        clientIdFinal = client.id;
      }
    }

    const snapIn = examSnapshot ?? {};
    const groups = Array.isArray(snapIn?.groups) ? snapIn.groups : [];
    const snap = {
      groups: groups.map((g: any) => ({
        id: g?.id ?? g?.gid ?? g?.label ?? "",
        label: String(g?.label || ""),
        selected: Array.isArray(g?.selected)
          ? g.selected.map((s: any) => ({ name: String(s?.name || ""), code: String(s?.code || "") }))
          : [],
      })),
      selectedA: snapIn?.selectedA || "",
      selectedB: snapIn?.selectedB || "",
      examCodes: snapIn?.examCodes || "",
    };

    const metaOut = {
      ...(metaIn || {}),
      foreigner: !!foreigner,
      email: email || null,
      address: address || null,
      exams: exams || null,
      survey: survey || null,
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
    };

    // 아이덴포턴시: 병원 스코프 + findFirst
    const idem = (req.headers.get("idempotency-key") || "").slice(0, 64);
    if (idem) {
      const exist = await prisma.booking.findFirst({
        where: { hospitalId: hosp.id, idempotencyKey: idem },
        select: { id: true, code: true },
      });
      if (exist) {
        return NextResponse.json({ ok: true, id: exist.id, code: exist.code }, { status: 200, headers: { "cache-control": "no-store" } });
      }
    }

    // 생성
    try {
      const created = await prisma.booking.create({
        data: {
          hospitalId: hosp.id,
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
      });
      return NextResponse.json({ ok: true, id: created.id, code: created.code }, { status: 201, headers: { "cache-control": "no-store" } });
    } catch (e: any) {
      if (e?.code === "P2002" && idem) {
        const existed = await prisma.booking.findFirst({
          where: { hospitalId: hosp.id, idempotencyKey: idem },
          select: { id: true, code: true },
        });
        if (existed) return NextResponse.json({ ok: true, id: existed.id, code: existed.code }, { status: 200 });
      }
      throw e;
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}




