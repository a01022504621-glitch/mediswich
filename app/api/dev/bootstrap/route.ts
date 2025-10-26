export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/dev/bootstrap/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import bcrypt from "bcryptjs";
 

type Body = {
  hospital: { name: string; slug: string };
  admin: { email: string; password: string; role?: "HOSPITAL_OWNER" | "HOSPITAL_STAFF" };
  planCode?: "BASIC" | "PRO" | "ENTERPRISE";
  seedSlots?: boolean;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  // ── 개발 보호 토큰 확인 ───────────────────────────────────────────────
  const hdr = req.headers.get("x-bootstrap-token") || "";
  const allow = process.env.DEV_BOOTSTRAP_TOKEN || "super-secret-token-123";
  if (hdr !== allow) return bad("FORBIDDEN", 403);

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const hospIn = body?.hospital;
  const adminIn = body?.admin;
  const planCode = body?.planCode || "PRO";
  const seedSlots = !!body?.seedSlots;

  if (!hospIn?.name || !hospIn?.slug) return bad("hospital{name,slug} required");
  if (!adminIn?.email || !adminIn?.password) return bad("admin{email,password} required");

  const slug = hospIn.slug.trim().toLowerCase();

  // ── 1) 요금제 upsert ────────────────────────────────────────────────
  const plan = await prisma.plan.upsert({
    where: { code: planCode },
    update: {},
    create: {
      code: planCode,
      name: planCode,
      priceKRW: planCode === "BASIC" ? 0 : planCode === "PRO" ? 99000 : 199000,
      features: { tier: planCode.toLowerCase() },
    },
  });

  // ── 2) 병원 upsert ─────────────────────────────────────────────────
  const hospital = await prisma.hospital.upsert({
    where: { slug },
    update: { name: hospIn.name },
    create: { slug, name: hospIn.name },
  });

  // ── 3) 관리자 upsert (즉시 로그인 가능하도록 mustChangePassword=false) ─
  const hash = await bcrypt.hash(adminIn.password, 10);
  const role = adminIn.role || "HOSPITAL_OWNER";

  const existing = await prisma.user.findFirst({
    where: { hospitalId: hospital.id, email: adminIn.email },
  });

  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { role, password: hash, mustChangePassword: false },
      })
    : await prisma.user.create({
        data: {
          email: adminIn.email,
          password: hash,
          role,
          hospitalId: hospital.id,
          mustChangePassword: false,
        },
      });

  // ── 4) 활성 구독 생성/갱신 (30일) ────────────────────────────────────
  const now = new Date();
  const nextEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const existingSub = await prisma.hospitalSubscription.findFirst({
    where: { hospitalId: hospital.id, status: "ACTIVE" },
  });

  if (existingSub) {
    await prisma.hospitalSubscription.update({
      where: { id: existingSub.id },
      data: { planId: plan.id, currentPeriodEnd: nextEnd, status: "ACTIVE" },
    });
  } else {
    await prisma.hospitalSubscription.create({
      data: {
        hospitalId: hospital.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEnd: nextEnd,
        billingType: "INVOICE",
      },
    });
  }

  // ── 5) 요일별 슬롯 템플릿 시드(옵션) ─────────────────────────────────
  if (seedSlots) {
    await prisma.slotTemplate.deleteMany({ where: { hospitalId: hospital.id } });
    const rows: { dow: number; start: string; end: string; capacity: number }[] = [];
    for (const d of [1, 2, 3, 4, 5]) rows.push({ dow: d, start: "08:00", end: "12:00", capacity: 10 });
    rows.push({ dow: 6, start: "08:00", end: "11:00", capacity: 8 });
    await prisma.slotTemplate.createMany({
      data: rows.map((r) => ({ ...r, hospitalId: hospital.id })),
    });
  }

  return NextResponse.json({
    ok: true,
    hospital: { id: hospital.id, slug: hospital.slug, name: hospital.name },
    admin: { id: admin.id, email: admin.email, role: admin.role },
    plan: { code: plan.code },
    seedSlots,
    hint: "로그인: /m/login 에서 위 이메일/비번 사용",
  });
}

