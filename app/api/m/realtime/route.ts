export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// util
type YMD = `${number}-${number}-${number}`;
const toYMD = (d: Date): YMD =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` as YMD;

function birth7toYMD(b?: string | null): string {
  const m = /^(\d{2})(\d{2})(\d{2})-?(\d)$/.exec(String(b || "").trim());
  if (!m) return "";
  const yy = +m[1], mm = +m[2], dd = +m[3], s = +m[4];
  const century = (s === 1 || s === 2) ? 1900 : (s === 3 || s === 4) ? 2000 : 1900;
  const yyyy = century + yy;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function mapStatusKR(s: string): "예약신청" | "예약확정" | "검진완료" | "취소" | "검진미실시" {
  const u = String(s || "").toUpperCase();
  if (u === "PENDING") return "예약신청";
  if (u === "RESERVED" || u === "CONFIRMED") return "예약확정";
  if (u === "COMPLETED") return "검진완료";
  if (u === "CANCELED") return "취소";
  if (u === "NO_SHOW") return "검진미실시";
  return "예약신청";
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const slug = sp.get("tenant") || undefined;
    const year = Number(sp.get("year") || new Date().getFullYear());
    const from = sp.get("from");
    const to = sp.get("to");

    // 병원 식별
    const hosp = slug
      ? await prisma.hospital.findFirst({ where: { slug }, select: { id: true } })
      : await prisma.hospital.findFirst({ select: { id: true } });
    if (!hosp) return NextResponse.json({ items: [] });

    // 기간
    const fromDate = from ? new Date(from) : new Date(year, 0, 1);
    const toDate = to ? new Date(to) : new Date(year + 1, 0, 1);

    const rows = await prisma.booking.findMany({
      where: { hospitalId: hosp.id, date: { gte: fromDate, lt: toDate } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        patientBirth: true,
        date: true,
        time: true,
        status: true,
        createdAt: true,
        meta: true,
        package: { select: { title: true } },
      },
    });

    const items = rows.map(r => {
      const m: any = r.meta || {};
      const corp = m?.corpName || m?.corp || "";
      const grade = m?.grade || "기타";
      const pkgTitle = m?.packageName || r.package?.title || "";
      const wanted = `${toYMD(r.date)}`
      const selA = m?.examSnapshot?.selectedA || "";
      const selB = m?.examSnapshot?.selectedB || "";
      const codes = m?.examSnapshot?.examCodes || "";
      const meds = (m?.meds ?? m?.medications ?? m?.form?.meds ?? "").toString().trim();
      const disease = (m?.disease ?? m?.history ?? m?.form?.disease ?? "").toString().trim();
      const coPay = Number(m?.coPayKRW ?? 0) || 0;
      const support = Number(m?.companySupportKRW ?? 0) || 0;

      return {
        id: r.id,
        고객사: corp,
        수검자명: r.name,
        등급: grade,
        생년월일: birth7toYMD(r.patientBirth),
        검진희망일: wanted,
        예약상태: mapStatusKR(r.status),
        패키지타입: pkgTitle,
        선택검사A: selA,
        선택검사B: selB,
        검사코드: codes,
        특수검진: m?.specialExam || "",
        특수물질: m?.specialMaterial || "",
        보건증: m?.healthCert ? "Y" : "N",
        회사지원금: support,
        본인부담금: coPay,
        복용약: meds ? meds : "없음",
        병력: disease ? disease : "없음",
        예약신청일: toYMD(r.createdAt as Date),
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}



