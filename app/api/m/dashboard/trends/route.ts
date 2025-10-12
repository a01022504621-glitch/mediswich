// app/api/m/dashboard/trends/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dayRange(d: Date) {
  const s = new Date(d); s.setHours(0, 0, 0, 0);
  const e = new Date(d); e.setHours(23, 59, 59, 999);
  return { s, e };
}

export async function GET() {
  const s = await requireSession();
  const hid = s.hid as string | undefined;
  if (!hid) return NextResponse.json({ labels: [], series: [] });

  const days = 14;
  const labels: string[] = [];
  const requested: number[] = [];
  const confirmed: number[] = [];
  const canceled: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const { s: ds, e: de } = dayRange(d);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

    const [r, c, ca] = await Promise.all([
      prisma.booking.count({ where: { hospitalId: hid, status: "PENDING",   date: { gte: ds, lte: de } } }),
      prisma.booking.count({ where: { hospitalId: hid, status: "CONFIRMED", date: { gte: ds, lte: de } } }),
      prisma.booking.count({ where: { hospitalId: hid, status: "CANCELED",  date: { gte: ds, lte: de } } }),
    ]);

    requested.push(r);
    confirmed.push(c);
    canceled.push(ca);
  }

  return NextResponse.json({
    labels,
    series: [
      { name: "요청", data: requested },
      { name: "확정", data: confirmed },
      { name: "취소", data: canceled },
    ],
  });
}

