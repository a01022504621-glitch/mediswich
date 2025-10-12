// prisma/seed.mjs
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

async function seedBase() {
  // 기본 테넌트(0 상태)
  const h = await prisma.hospital.upsert({
    where: { slug: "hihospital" },
    update: {},
    create: {
      slug: "hihospital",
      name: "하이병원 검진센터",
      themeJson: JSON.stringify({ primary: "#4F46E5" }),
      noticeHtml: "<h3>공지</h3><p>예약 전 주의사항을 확인해주세요.</p>",
    },
  });

  await prisma.user.upsert({
    where: { hospitalId_email: { hospitalId: h.id, email: "owner@hihospital.kr" } },
    update: {},
    create: {
      email: "owner@hihospital.kr",
      password: await hash("Passw0rd!"),
      role: "HOSPITAL_OWNER",
      hospitalId: h.id,
    },
  });
}

async function seedDemo() {
  // 데모 테넌트(표본 데이터 포함)
  const h = await prisma.hospital.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Mediswitch 데모 병원",
      themeJson: JSON.stringify({ primary: "#10B981" }),
      noticeHtml: "<h3>데모 공지</h3><p>이곳은 시연용입니다.</p>",
    },
  });

  await prisma.user.upsert({
    where: { hospitalId_email: { hospitalId: h.id, email: "owner@demo.kr" } },
    update: {},
    create: {
      email: "owner@demo.kr",
      password: await hash("Passw0rd!"),
      role: "HOSPITAL_OWNER",
      hospitalId: h.id,
    },
  });

  // 회사/패키지: unique 제약 몰라도 안전하게 find-or-create
  let comp = await prisma.company.findFirst({
    where: { hospitalId: h.id, name: "데모 주식회사" },
    select: { id: true },
  });
  if (!comp) {
    comp = await prisma.company.create({
      data: { name: "데모 주식회사", token: "DEMO-COMPANY", hospitalId: h.id },
      select: { id: true },
    });
  }

  let pkg = await prisma.package.findFirst({
    where: { hospitalId: h.id, title: "데모 종합검진" },
    select: { id: true },
  });
  if (!pkg) {
    pkg = await prisma.package.create({
      data: { title: "데모 종합검진", price: 200000, visible: true, hospitalId: h.id },
      select: { id: true },
    });
  }

  const today = new Date();
  const add = (d) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);

  await prisma.booking.createMany({
    data: [
      { hospitalId: h.id, companyId: comp.id, packageId: pkg.id, date: add(0),  time: "09:00", name: "김데모",  phone: "010-1111-2222", status: "REQUESTED" },
      { hospitalId: h.id, companyId: comp.id, packageId: pkg.id, date: add(1),  time: "10:30", name: "이가상",  phone: "010-2222-3333", status: "CONFIRMED" },
      { hospitalId: h.id, companyId: comp.id, packageId: pkg.id, date: add(2),  time: "11:00", name: "박시연",  phone: "010-3333-4444", status: "CONFIRMED" },
      { hospitalId: h.id, companyId: comp.id, packageId: pkg.id, date: add(-1), time: "15:00", name: "최테스트", phone: "010-4444-5555", status: "CANCELED" },
    ],
    skipDuplicates: true,
  });
}

try {
  console.log("Seeding Mediswitch…");
  await seedBase();

  if (process.env.DEMO_SEED === "1") {
    console.log("Demo seed enabled");
    await seedDemo();
  }

  console.log("✅ Seed complete");
} catch (err) {
  console.error("❌ Seed failed:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
