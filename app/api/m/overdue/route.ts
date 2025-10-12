// app/api/m/overdue/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const s = await requireSession();
  const hid = s.hid as string | undefined;
  if (!hid) return NextResponse.json({ error: "No hospital" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 50);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const rows = await prisma.booking.findMany({
    where: {
      hospitalId: hid,
      date: { lt: today },
      status: { in: ["RESERVED", "CONFIRMED"] as any }, // 스키마 enum에 맞춤
    },
    orderBy: [{ date: "asc" }],
    take: limit,
    include: { package: true }, // Booking에 존재하는 관계만 포함
  });

  const items = rows.map((r) => ({
    id: r.id,
    date: r.date,
    packageName: (r as any).package?.name ?? "-",
    clientName: null as string | null,
  }));

  return NextResponse.json({ items, total: rows.length });
}


