// app/api/m/dashboard/v2/dow/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

const kst0 = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n*86400000);
const toYMD = (d: Date) => `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from")!;
    const to   = url.searchParams.get("to") || from;

    const s = await requireSession();
    const hospitalId = (s as any).hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok:false, error:"NO_HOSPITAL" }, { status:401 });

    const fromK = kst0(from);
    const toK   = addDays(kst0(to), 1);

    const rows = await runAs(hospitalId, () =>
      prisma.booking.findMany({
        where: { hospitalId, createdAt: { gte: fromK, lt: toK } }, // 신청일 기준
        select: { createdAt:true }
      })
    );

    const dow = Array.from({length:7}, ()=>0);
    const hours = Array.from({length:24}, ()=>0);

    for (const b of rows) {
      const dt = new Date(b.createdAt as any);
      // KST 기준 라벨
      const ymd = toYMD(dt);
      const kst = new Date(`${ymd}T${dt.toTimeString().slice(0,8)}+09:00`);
      dow[kst.getDay()] += 1;
      hours[kst.getHours()] += 1;
    }

    return NextResponse.json({
      ok:true,
      dow: { labels:["일","월","화","수","목","금","토"], data:dow },
      hours: { labels:Array.from({length:24},(_,i)=>`${i}시`), data:hours }
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ ok:false, error:e?.message || "INTERNAL" }, { status:500 });
  }
}


