import prisma from "@/lib/prisma-scope";
import bcrypt from "bcryptjs";

type Params = {
  slug: string;               // 영문/숫자/하이픈
  hospitalName: string;
  ownerEmail: string;
  tempPassword?: string;
};

function makeTempPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function provisionHospitalOwner(p: Params) {
  const temp = p.tempPassword || makeTempPassword();

  const hospital = await prisma.hospital.upsert({
    where: { slug: p.slug },
    create: { slug: p.slug, name: p.hospitalName },
    update: {},
  });

  const hash = await bcrypt.hash(temp, 10);
  const user = await prisma.user.upsert({
    where: { hospitalId_email: { hospitalId: hospital.id, email: p.ownerEmail } },
    create: {
      email: p.ownerEmail,
      password: hash,
      role: "HOSPITAL_OWNER",
      hospitalId: hospital.id,
      mustChangePassword: true,
    },
    update: {
      password: hash,
      role: "HOSPITAL_OWNER",
      hospitalId: hospital.id,
      mustChangePassword: true,
    },
  });

  // 기본 슬롯 템플릿(평일 07:00~10:00, 30분 간격 cap=10)
  await prisma.slotTemplate.createMany({
    data: [1,2,3,4,5].map((dow) => ({
      dow, start: "07:00", end: "10:00", capacity: 10, hospitalId: hospital.id,
    })),
    skipDuplicates: true,
  });

  return {
    hospital: { id: hospital.id, slug: hospital.slug, name: hospital.name },
    admin: { id: user.id, email: user.email },
    tempPassword: temp, // 병원에 전달
  };
}
