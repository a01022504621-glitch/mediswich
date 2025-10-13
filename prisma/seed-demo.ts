import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * DB 스키마를 자동으로 분석하여 가장 적합한 관리자 Role을 찾아냅니다.
 * 이로 인해 Role Enum의 이름이 변경되어도 스크립트가 깨지지 않습니다.
 */
function pickAdminRole(): any {
  const preferred = ["HOSPITAL_ADMIN", "ADMIN", "OWNER", "SUPERADMIN", "MANAGER"];
  
  // 1. Prisma Client에 노출된 Enum 객체에서 직접 찾기 (가장 안정적)
  const roleEnum: any = (Prisma as any).Role || {};
  const availableRoles = Object.values(roleEnum);
  if (availableRoles.length) {
    const found = preferred.find(v => availableRoles.includes(v));
    if (found) return found;
    return availableRoles[0]; // 선호하는 Role이 없으면 첫 번째 Role이라도 반환
  }

  // 2. (Fallback) DMMF(내부 스키마 정보)를 파싱하여 Enum 값을 찾기
  try {
    const dmmfEnums = ((Prisma as any).dmmf?.datamodel?.enums || []);
    const roleDmmf = dmmfEnums.find((e: any) => e.name === "Role");
    const dmmfRoleValues = roleDmmf?.values?.map((v: any) => v.name) || [];
    
    if (dmmfRoleValues.length) {
      const found = preferred.find(v => dmmfRoleValues.includes(v));
      if (found) return found;
      return dmmfRoleValues[0];
    }
  } catch {}

  throw new Error("Role enum을 찾을 수 없습니다. prisma/schema.prisma 파일에 'enum Role'이 올바르게 정의되었는지 확인하세요.");
}

async function main() {
  const slug = "gogohospital";
  const name = "고고병원";
  const email = "gogo@admin.co.kr";
  const plain = process.env.DEMO_ADMIN_PASSWORD || "admin1234!";
  const adminRole = pickAdminRole();

  console.log(`[seed] '${slug}' 병원과 관리자 계정 생성을 시작합니다...`);
  console.log(`[seed] 감지된 관리자 역할: ${adminRole}`);

  // 1) 병원 upsert
  const hospital = await prisma.hospital.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });

  // 2) 관리자 upsert (복합 유니크 및 자동 감지된 Role 사용)
  const hash = await bcrypt.hash(plain, 12);
  await prisma.user.upsert({
    where: { hospitalId_email: { hospitalId: hospital.id, email } },
    update: { password: hash, role: adminRole },
    create: { email, password: hash, role: adminRole, hospitalId: hospital.id },
  });

  // 3) (선택) 도메인 매핑
  try {
    // hospitalDomain 테이블의 컬럼명이 'host'라고 가정
    await (prisma as any).hospitalDomain.upsert({
      where: { host: `${slug}.mediswich.co.kr` },
      update: { hospitalId: hospital.id, isPrimary: true },
      create: { host: `${slug}.mediswich.co.kr`, hospitalId: hospital.id, isPrimary: true },
    });
  } catch (e) {
    console.warn(`[seed] 'hospitalDomain' 테이블이 없거나 스키마가 달라 건너뜁니다. (이유: ${(e as Error).message})`);
  }

  console.log("✅ [seed] 성공:", { hospital: hospital.slug, email, role: adminRole });
}

main()
  .catch((e) => {
    console.error("❌ [seed] 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
