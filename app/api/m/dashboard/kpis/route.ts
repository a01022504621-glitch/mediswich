export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/m/dashboard/kpis/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
 

function dayRange(d = new Date()) {
  const s = new Date(d); s.setHours(0, 0, 0, 0);
  const e = new Date(d); e.setHours(23, 59, 59, 999);
  return { s, e };
}

export async function GET() {
  const s = await requireSession();
  const hid = s.hid as string | undefined;
  if (!hid) return NextResponse.json({ error: "No hospital" }, { status: 401 });

  const { s: todayStart, e: todayEnd } = dayRange();
  const in7 = new Date(Date.now() + 7 * 86400000);

  const [todayReq, todayConf, todayCanc, next7Conf, overdueCount] = await Promise.all([
    prisma.booking.count({ where: { hospitalId: hid, status: "PENDING",   date: { gte: todayStart, lte: todayEnd } } }),
    prisma.booking.count({ where: { hospitalId: hid, status: "CONFIRMED", date: { gte: todayStart, lte: todayEnd } } }),
    prisma.booking.count({ where: { hospitalId: hid, status: "CANCELED",  date: { gte: todayStart, lte: todayEnd } } }),
    prisma.booking.findMany({
      where: { hospitalId: hid, status: "CONFIRMED", date: { gte: todayStart, lte: in7 } },
      select: { id: true, package: { select: { price: true } } },
    }),
    // 미수검 건수(오늘 이전, 확정이거나 예약상태)
    prisma.booking.count({
      where: {
        hospitalId: hid,
        date: { lt: todayStart },
        OR: [{ status: "RESERVED" }, { status: "CONFIRMED" }],
      },
    }),
  ]);

  const revenue7 = next7Conf.reduce((a, x) => a + Number(x.package?.price ?? 0), 0);
  const cancelRate = (todayConf + todayCanc) ? Math.round((todayCanc / (todayConf + todayCanc)) * 100) : 0;

  return NextResponse.json({
    today: { requested: todayReq, confirmed: todayConf, canceled: todayCanc, cancelRate },
    next7: { confirmed: next7Conf.length, revenue: revenue7 },
    overdue: { count: overdueCount }, // ✅ 대시보드에서 사용
  });
}

