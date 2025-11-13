// app/api/m/dashboard/v2/series/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { pickBasisDate } from "@/lib/services/booking-effective-date";

type YMD = `${number}-${number}-${number}`;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d: Date): YMD => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` as YMD;
const kst0 = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n*86400000);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from")!;
    const to = url.searchParams.get("to") || from;

    const s = await requireSession();
    const hospitalId = (s as any).hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok:false, error:"NO_HOSPITAL" }, { status:401 });

    const fromK = kst0(from);
    const toK   = addDays(kst0(to), 1);

    const [bookings, changes] = await Promise.all([
      runAs(hospitalId, () =>
        prisma.booking.findMany({
          where: {
            hospitalId,
            OR: [
              { createdAt: { gte: fromK, lt: toK } },
              { date:       { gte: fromK, lt: toK } },
              { effectiveDate: { gte: fromK, lt: toK } },
            ],
          },
          select: { createdAt:true, date:true, meta:true }
        })
      ),
      runAs(hospitalId, () =>
        prisma.bookingChangeLog.findMany({
          where: { booking: { hospitalId }, createdAt: { gte: fromK, lt: toK } },
          select: { createdAt:true }
        })
      )
    ]);

    // 라벨
    const labels: YMD[] = [];
    for (let d = new Date(fromK); +d < +toK; d = addDays(d, 1)) labels.push(toYMD(d));

    const zero = () => labels.map(() => 0);
    const requested = zero(), confirmed = zero(), completed = zero(), changed = zero();

    for (const b of bookings) {
      const r = b.createdAt, c = pickBasisDate(b,"confirmed"), d = pickBasisDate(b,"completed");
      if (r) { const i = labels.indexOf(toYMD(r)); if (i >= 0) requested[i] += 1; }
      if (c) { const i = labels.indexOf(toYMD(c)); if (i >= 0) confirmed[i] += 1; }
      if (d) { const i = labels.indexOf(toYMD(d)); if (i >= 0) completed[i] += 1; }
    }
    for (const ch of changes) {
      const i = labels.indexOf(toYMD(ch.createdAt as any));
      if (i >= 0) changed[i] += 1;
    }

    return NextResponse.json({ ok:true, labels, series:{ requested, confirmed, changed, completed } });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ ok:false, error:e?.message || "INTERNAL" }, { status:500 });
  }
}


