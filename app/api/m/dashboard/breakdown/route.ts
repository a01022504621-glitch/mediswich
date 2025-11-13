// app/api/m/dashboard/breakdown/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";

/** 성별/연령대 타입 */
type SexKey = "M" | "F" | "UNKNOWN";
type AgeBand =
  | "20대 이하"
  | "20대"
  | "30대"
  | "40대"
  | "50대"
  | "60대"
  | "70대 이상"
  | "미상";

/** yymmdd-? 형식에서 세기/성별/생년월일 추출 */
function parseBirthAndSex(raw?: string): {
  birth: Date | null;
  sex: SexKey;
} {
  if (!raw) return { birth: null, sex: "UNKNOWN" };

  // 숫자만 추출 후 앞 6자리와 그 다음 한 자리 사용
  const m = String(raw).match(/(\d{6})\D?(\d)?/);
  if (!m) return { birth: null, sex: "UNKNOWN" };

  const six = m[1]; // YYMMDD
  const code = m[2] ? Number(m[2]) : NaN; // 7번째 자리

  const yy = Number(six.slice(0, 2));
  const mm = Number(six.slice(2, 4));
  const dd = Number(six.slice(4, 6));

  // 세기 판별: 1,2,5,6 → 1900 / 3,4,7,8 → 2000 / 그 외 fallback
  let century = 0;
  if ([1, 2, 5, 6].includes(code)) century = 1900;
  else if ([3, 4, 7, 8].includes(code)) century = 2000;
  else century = yy >= 50 ? 1900 : 2000; // 안전 추정

  let sex: SexKey = "UNKNOWN";
  if ([1, 3, 5, 7].includes(code)) sex = "M";
  else if ([2, 4, 6, 8].includes(code)) sex = "F";

  // 날짜 유효성 보정
  try {
    const birth = new Date(century + yy, (mm || 1) - 1, dd || 1);
    if (isNaN(birth.getTime())) return { birth: null, sex };
    return { birth, sex };
  } catch {
    return { birth: null, sex };
  }
}

function ageBand(birth: Date | null, base: Date): AgeBand {
  if (!birth) return "미상";
  let age = base.getFullYear() - birth.getFullYear();
  const m = base.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && base.getDate() < birth.getDate())) age -= 1;

  if (age < 20) return "20대 이하";
  if (age < 30) return "20대";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  if (age < 70) return "60대";
  return "70대 이상";
}

const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"] as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fromISO = url.searchParams.get("from");
    const toISO = url.searchParams.get("to");

    const to = toISO ? new Date(toISO) : new Date();
    const from = fromISO
      ? new Date(fromISO)
      : new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6); // 기본 최근 7일

    // 병원 스코프는 prisma-scope(ALS)로 주입된다고 가정
    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: from, lte: to }, // ‘예약신청일’ 기준
      },
      select: {
        createdAt: true,
        sex: true,                // Prisma enum Sex | null
        patientBirth: true,       // 주민번호 형태 문자열 가능
        package: { select: { title: true, price: true } },
        company: { select: { name: true } },
      },
    });

    // ── 성별/연령대 집계
    const sexCount: Record<SexKey, number> = { M: 0, F: 0, UNKNOWN: 0 };
    const ageCount: Record<AgeBand, number> = {
      "20대 이하": 0,
      "20대": 0,
      "30대": 0,
      "40대": 0,
      "50대": 0,
      "60대": 0,
      "70대 이상": 0,
      "미상": 0,
    };

    // ── 요일/시간대(고정 축) 초기화
    const dowMap = new Map<number, number>();
    for (let i = 0; i < 7; i++) dowMap.set(i, 0);

    const hourMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourMap.set(h, 0);

    // ── 패키지/고객사 집계
    type PAcc = { count: number; amountKRW: number };
    const pkgAcc = new Map<string, PAcc>();  // key: package title
    const compAcc = new Map<string, PAcc>(); // key: company name

    for (const b of bookings) {
      // 성별 및 연령대
      const parsed = parseBirthAndSex(b.patientBirth ?? undefined);
      const sexKey: SexKey =
        b.sex === "M" || b.sex === "F" ? b.sex : parsed.sex; // DB 성별 우선, 없으면 주민등록번호 추정
      sexCount[sexKey] += 1;

      const band = ageBand(parsed.birth, to); // AgeBand 로 좁혀짐
      ageCount[band] += 1;

      // 요일/시간대
      const d = b.createdAt;
      dowMap.set(d.getDay(), (dowMap.get(d.getDay()) ?? 0) + 1);
      hourMap.set(d.getHours(), (hourMap.get(d.getHours()) ?? 0) + 1);

      // 패키지
      const pkgTitle = b.package?.title ?? "기타";
      const price = b.package?.price ?? 0;
      const p = pkgAcc.get(pkgTitle) ?? { count: 0, amountKRW: 0 };
      p.count += 1;
      p.amountKRW += price;
      pkgAcc.set(pkgTitle, p);

      // 고객사
      const cname = b.company?.name ?? "개인";
      const c = compAcc.get(cname) ?? { count: 0, amountKRW: 0 };
      c.count += 1;
      c.amountKRW += price;
      compAcc.set(cname, c);
    }

    const orderedBands: AgeBand[] = [
      "20대 이하",
      "20대",
      "30대",
      "40대",
      "50대",
      "60대",
      "70대 이상",
      "미상",
    ];

    const ageBands = orderedBands.map((k) => ({ band: k, count: ageCount[k] }));

    const byDow = Array.from({ length: 7 }, (_, i) => ({
      dow: i,
      label: DOW_LABEL[i],
      count: dowMap.get(i) ?? 0,
    }));

    const byHour = Array.from({ length: 24 }, (_, h) => ({
      h,
      count: hourMap.get(h) ?? 0,
    }));

    const topPackages = Array.from(pkgAcc.entries())
      .map(([title, v]) => ({ id: title, title, count: v.count, amountKRW: v.amountKRW }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCompanies = Array.from(compAcc.entries())
      .map(([name, v]) => ({ id: name, name, count: v.count, amountKRW: v.amountKRW }))
      .sort((a, b) => b.amountKRW - a.amountKRW)
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      sex: sexCount,
      ageBands,
      topPackages,
      byDow,
      byHour,
      topCompanies,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}







