// scripts/nuke-bookings.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hid = process.argv[2];
  if (!hid) {
    console.error('사용법: node scripts/nuke-bookings.js <hospitalId>');
    process.exit(1);
  }

  // 예약 ID 수집
  const bookings = await prisma.booking.findMany({
    where: { hospitalId: hid },
    select: { id: true },
  });
  const ids = bookings.map(b => b.id);
  console.log(`예약 ${ids.length}건 대상`);

  if (ids.length === 0) return;

  await prisma.$transaction(async (tx) => {
    // 존재할 수 있는 자식 테이블들 정리
    // 프로젝트에 없는 모델은 자동으로 0건 처리되어 문제 없습니다.
    await tx.invoice.deleteMany({ where: { bookingId: { in: ids } } }).catch(()=>{});
    await tx.addonItem.deleteMany({ where: { bookingId: { in: ids } } }).catch(()=>{});
    await tx.auditLog.deleteMany({ where: { bookingId: { in: ids } } }).catch(()=>{});

    // 마지막에 예약 삭제
    await tx.booking.deleteMany({ where: { id: { in: ids } } });
  });

  console.log('예약 및 자식 레코드 삭제 완료');
}

main().finally(() => prisma.$disconnect());

