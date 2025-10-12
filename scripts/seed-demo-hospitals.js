// scripts/seed-demo-hospitals.js
const { PrismaClient, Prisma } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

function pickRole() {
  const enumRole = Prisma?.dmmf?.datamodel?.enums?.find?.(e => e.name === "Role");
  const values = (enumRole?.values || []).map(v => (typeof v === "string" ? v : v.name));
  if (!values.length) {
    throw new Error("Prisma enum 'Role'을 찾을 수 없습니다. schema.prisma를 확인하세요.");
  }
  // 선호 순서: ADMIN → OWNER → 첫 값
  if (values.includes("ADMIN")) return "ADMIN";
  if (values.includes("OWNER")) return "OWNER";
  return values[0];
}

async function upsertHospitalWithAdmin({ slug, name, email, password }) {
  const role = pickRole();

  const hospital = await prisma.hospital.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });

  const passHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findFirst({
    where: { hospitalId: hospital.id, email },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: passHash, role },
    });
  } else {
    await prisma.user.create({
      data: { hospitalId: hospital.id, email, password: passHash, role },
    });
  }

  console.log(`✅ ${name}(${slug}) 관리자 준비됨 → ${email} (role=${role})`);
}

(async () => {
  try {
    await upsertHospitalWithAdmin({
      slug: "gogohospital",
      name: "고고병원",
      email: "gogo@admin.co.kr",
      password: "admin1234!",
    });

    await upsertHospitalWithAdmin({
      slug: "hihospital",
      name: "하이병원",
      email: "hi@admin.co.kr",
      password: "admin1234!",
    });
  } catch (e) {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
