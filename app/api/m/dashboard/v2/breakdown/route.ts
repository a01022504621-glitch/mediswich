// app/api/m/dashboard/v2/breakdown/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

const kst0 = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n*86400000);
const toInt = (x:any) => (Number.isFinite(+x) ? +x : 0);

function ageBucket(birth: string | null | undefined, asOf: Date): string {
  if (!birth) return "미상";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth) || /^(\d{4})(\d{2})(\d{2})$/.exec(birth);
  if (!m) return "미상";
  const y = +m[1], mo = +m[2]-1, d = +m[3];
  const dt = new Date(y, mo, d);
  if (Number.isNaN(+dt)) return "미상";
  let age = asOf.getFullYear() - dt.getFullYear();
  const mcmp = asOf.getMonth() - dt.getMonth();
  if (mcmp < 0 || (mcmp === 0 && asOf.getDate() < dt.getDate())) age--;
  if (age < 0 || age > 120) return "미상";
  return `${Math.floor(age/10)*10}대`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const span = Math.max(1, Math.min(90, Number(url.searchParams.get("span") ?? 7)));
    const to = url.searchParams.get("to")!;
    const fromK = addDays(kst0(to), -(span - 1));
    const toK   = addDays(kst0(to), 1);

    const s = await requireSession();
    const hospitalId = (s as any).hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok:false, error:"NO_HOSPITAL" }, { status:401 });

    const rows = await runAs(hospitalId, () =>
      prisma.booking.findMany({
        where: { hospitalId, createdAt: { gte: fromK, lt: toK } }, // 신청일 기준
        select: {
          sex:true, patientBirth:true, meta:true,
          package: { select: { title:true, price:true } }
        }
      })
    );

    const sexMap = new Map<string,number>();
    const ageMap = new Map<string,number>();
    const pkgCount = new Map<string,number>();
    const pkgRevenue = new Map<string,number>();

    for (const b of rows) {
      const sex = b.sex === "M" ? "남" : b.sex === "F" ? "여" : "미상";
      sexMap.set(sex, (sexMap.get(sex) || 0) + 1);

      const ab = ageBucket(b.patientBirth, toK);
      ageMap.set(ab, (ageMap.get(ab) || 0) + 1);

      const title = b.package?.title || "미지정 패키지";
      const price = toInt((b as any)?.meta?.patientPrice) || toInt((b as any)?.meta?.price) || toInt(b.package?.price) || 0;
      pkgCount.set(title, (pkgCount.get(title) || 0) + 1);
      pkgRevenue.set(title, (pkgRevenue.get(title) || 0) + price);
    }

    const top = [...pkgCount.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
      .map(([k,v]) => ({ title:k, count:v, revenue: pkgRevenue.get(k) || 0 }));

    return NextResponse.json({
      ok:true,
      sex: { labels:[...sexMap.keys()], data:[...sexMap.values()] },
      age: { labels:[...ageMap.keys()], data:[...ageMap.values()] },
      top: { labels: top.map(x=>x.title), counts: top.map(x=>x.count), revenue: top.map(x=>x.revenue) }
    });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ ok:false, error:e?.message || "INTERNAL" }, { status:500 });
  }
}

