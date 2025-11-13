// app/api/m/dashboard/insights/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";
import { readDefaultCapOrZero } from "@/lib/repos/capacitySettings.repo";

type YMD = `${number}-${number}-${number}`;
const toYMD = (d: Date): YMD =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function endOfDay(d: Date)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0); }

function parseISODate(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0) : null;
}

function birthYearOf(raw?: string | null): number | null {
  if (!raw) return null;
  const s = String(raw).replace(/\D/g, "");
  const y4 = /^(\d{4})/.exec(s)?.[1];
  if (y4) return +y4;
  if (s.length >= 2) {
    const yy = +s.slice(0, 2);
    const curYY = new Date().getFullYear() % 100;
    return (yy > curYY ? 1900 : 2000) + yy;
  }
  return null;
}
function ageBucket(raw?: string | null): string {
  const y = birthYearOf(raw);
  if (!y) return "미상";
  const age = new Date().getFullYear() - y;
  if (age < 30) return "20대↓";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  if (age < 70) return "60대";
  return "70대↑";
}

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hospitalId = s.hid ?? (s as any).hospitalId;

    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const toStr   = url.searchParams.get("to");

    const today = startOfDay(new Date());
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
    const from = parseISODate(fromStr) ?? defaultFrom;
    const toNext = endOfDay(parseISODate(toStr) ?? today);

    // ── 오늘 사용/케파
    const activeForUsage = ["RESERVED","CONFIRMED","AMENDED","COMPLETED"] as const;
    const todayUsed = await prisma.booking.count({
      where: { hospitalId, effectiveDate: { gte: today, lt: endOfDay(today) }, status: { in: activeForUsage as any } },
    });

    const defaults = await readDefaultCapOrZero(hospitalId);
    let todayCap = Number(defaults.BASIC || 0);
    if (!(todayCap > 0)) {
      const dow = today.getDay();
      const temps = await prisma.slotTemplate.findMany({
        where: { hospitalId, dow },
        select: { start: true, end: true, capacity: true },
      });
      let sum = 0;
      for (const t of temps) {
        const [sh, sm] = t.start.split(":").map(Number);
        const [eh, em] = t.end.split(":").map(Number);
        const slots = Math.max(0, Math.floor(((eh*60+em) - (sh*60+sm)) / 30) + 1);
        sum += slots * (t.capacity || 0);
      }
      todayCap = sum > 0 ? sum : 999;
    }

    // ── 7일 KPI (효과일 기준)
    const sevenAgo = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
    const [kNewReq, kInProg, kCanceled] = await Promise.all([
      prisma.booking.count({ where: { hospitalId, effectiveDate: { gte: sevenAgo }, status: "PENDING" as any } }),
      prisma.booking.count({ where: { hospitalId, effectiveDate: { gte: sevenAgo }, status: { in: ["RESERVED","CONFIRMED","AMENDED"] as any } } }),
      prisma.booking.count({ where: { hospitalId, effectiveDate: { gte: sevenAgo }, status: "CANCELED" as any } }),
    ]);

    // ── 기간 내 상세 (효과일 사용 + fallback)
    const rows = await prisma.booking.findMany({
      where: {
        hospitalId,
        OR: [
          { effectiveDate: { gte: from, lt: toNext } },
          { AND: [{ effectiveDate: null }, { date: { gte: from, lt: toNext } }] },
        ],
      },
      select: {
        date: true,
        effectiveDate: true,
        status: true,
        sex: true,
        patientBirth: true,
        package: { select: { title: true, price: true } },
      },
    });

    // 추세
    const trendMap = new Map<YMD, { requested: number; inProgress: number; completed: number; canceled: number }>();
    for (let d = new Date(from); d < toNext; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      trendMap.set(toYMD(d), { requested: 0, inProgress: 0, completed: 0, canceled: 0 });
    }
    for (const r of rows) {
      const eff = r.effectiveDate ?? r.date;
      const key = toYMD(startOfDay(eff));
      const slot = trendMap.get(key);
      if (!slot) continue;
      switch (r.status) {
        case "PENDING":   slot.requested += 1; break;
        case "RESERVED":
        case "CONFIRMED":
        case "AMENDED":   slot.inProgress += 1; break;
        case "COMPLETED": slot.completed  += 1; break;
        case "CANCELED":  slot.canceled   += 1; break;
        default: break;
      }
    }
    const trend = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }));

    // 분포
    const genderCnt = new Map<string, number>([["남",0],["여",0],["미상",0]]);
    const ageCnt = new Map<string, number>();
    const pkgCnt = new Map<string, { count: number; revenue: number }>();

    for (const r of rows) {
      const g = r.sex === "M" ? "남" : r.sex === "F" ? "여" : "미상";
      genderCnt.set(g, (genderCnt.get(g) || 0) + 1);

      const ab = ageBucket(r.patientBirth);
      ageCnt.set(ab, (ageCnt.get(ab) || 0) + 1);

      const pName = r.package?.title ?? "미지정";
      const price = Number(r.package?.price ?? 0) || 0;
      const cur = pkgCnt.get(pName) || { count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += price;
      pkgCnt.set(pName, cur);
    }

    const breakdown = {
      gender: Array.from(genderCnt.entries()).map(([label, value]) => ({ label, value })),
      age: Array.from(ageCnt.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value })),
      packages: Array.from(pkgCnt.entries()).sort((a,b) => b[1].count - a[1].count).slice(0,10)
        .map(([label, v]) => ({ label, value: v.count, revenue: v.revenue })),
    };

    return NextResponse.json({
      ok: true,
      head: { todayUsed, todayCap, usageRate: todayCap > 0 ? todayUsed / todayCap : 0 },
      kpis: { last7: { newRequests: kNewReq, inProgress: kInProg, canceled: kCanceled } },
      trend,
      breakdown,
      range: { from: toYMD(from), to: toYMD(new Date(toNext.getTime() - 1)) },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}



