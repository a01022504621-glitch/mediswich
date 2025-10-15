// 경로: mediswich/app/api/public/[tenant]/booking/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

// 카테고리 → 검진유형 라벨
const categoryToLabel = (cat?: string | null) => {
  const u = String(cat || "").toUpperCase();
  if (u === "NHIS") return "공단검진";
  if (u === "CORP") return "기업/단체";
  return "종합검진";
};

export async function POST(req: NextRequest, { params }: { params: { tenant: string } }) {
  try {
    const body = await req.json();
    const {
      // 기본
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

      // 메타 강화(예약자 페이지 or 외부 연동에서 전달 가능)
      examSnapshot,          // { groups:[{id,label,selected:[{name,code}]}], selectedA, selectedB, examCodes }
      examType,              // "공단검진" | "종합검진" | "기업/단체" (없으면 패키지 카테고리로 유추)
      totalKRW,              // 총 비용(패키지+옵션 등)
      companySupportKRW,     // 회사지원금
      coPayKRW,              // 본인부담금(미지정 시 total - support)
      corpName, corp, grade, // 선택적 고객사 메타
      specialExam, specialMaterial, healthCert, // 특수검진 관련
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
      select: { id: true, title: true, price: true, category: true },
    });
    if (!pkg) return NextResponse.json({ error: "package not found" }, { status: 404 });

    const dt = parseYMD_HHMM(String(datetime));
    if (!dt) return NextResponse.json({ error: "invalid datetime" }, { status: 400 });

    const dayStart = new Date(dt.date.getFullYear(), dt.date.getMonth(), dt.date.getDate(), 0, 0, 0, 0);
    const nextStart = new Date(dt.date.getFullYear(), dt.date.getMonth(), dt.date.getDate() + 1, 0, 0, 0, 0);

    const closedMap = await findClosedDates(hosp.id, dayStart, nextStart);
    if (closedMap.has(toYMD(dayStart))) {
      return NextResponse.json({ error: "closed", code: "CLOSED" }, { status: 409 });
    }

    const dow = dayStart.getDay();
    const templates = await prisma.slotTemplate.findMany({
      where: { hospitalId: hosp.id, dow },
      select: { start: true, end: true, capacity: true },
      orderBy: { start: "asc" },
    });

    const within = (hhmm: string, start: string, end: string) => start <= hhmm && hhmm <= end;
    let capForSlot = 0;
    for (const t of templates) {
      if (within(dt.hhmm, t.start, t.end)) capForSlot = Math.max(capForSlot, t.capacity || 0);
    }
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

    const phoneDigits = String(phone).replace(/\D/g, "");
    const sexEnum = inferSex(sex);

    // 비용 보정
    const pkgPrice = Number(pkg.price ?? 0) || 0;
    const total = Number(totalKRW ?? pkgPrice) || 0;
    const support = Number(companySupportKRW ?? 0) || 0;
    const copay = Number(coPayKRW ?? Math.max(0, total - support)) || 0;

    // 검진유형 보정
    const examTypeLabel = String(examType || categoryToLabel(pkg.category));

    // examSnapshot 정규화
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
        meta: {
          // 기존
          foreigner: !!foreigner,
          email: email || null,
          address: address || null,
          exams: exams || null,
          survey: survey || null,
          packageName: packageName || pkg.title || null,
          source: "public",

          // 신규/보강
          examSnapshot: snap,
          examType: examTypeLabel,              // 공단검진/종합검진/기업/단체
          totalKRW: total,
          companySupportKRW: support,
          coPayKRW: copay,
          packageCategory: pkg.category || null,
          packageCategoryLabel: examTypeLabel,

          // 선택적 부가 메타 패스스루
          corpName: corpName ?? corp ?? null,
          grade: grade ?? null,
          specialExam: specialExam ?? null,
          specialMaterial: specialMaterial ?? null,
          healthCert: !!healthCert || false,
        },
      },
      select: { id: true, code: true },
    });

    return NextResponse.json({ ok: true, id: created.id, code: created.code });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}




