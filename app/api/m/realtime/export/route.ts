export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Excel from "exceljs";

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
function mapStatusKR(s: string) {
  const u = String(s || "").toUpperCase();
  if (u === "PENDING") return "예약신청";
  if (u === "RESERVED" || u === "CONFIRMED") return "예약확정";
  if (u === "COMPLETED") return "검진완료";
  if (u === "CANCELED") return "취소";
  if (u === "NO_SHOW") return "검진미실시";
  return "예약신청";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ids = (sp.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
  const slug = sp.get("tenant") || undefined;

  // 병원
  const hosp = slug
    ? await prisma.hospital.findFirst({ where: { slug }, select: { id: true, slug: true } })
    : await prisma.hospital.findFirst({ select: { id: true, slug: true } });
  if (!hosp) return NextResponse.json({ error: "hospital not found" }, { status: 404 });

  const rows = await prisma.booking.findMany({
    where: { hospitalId: hosp.id, ...(ids.length ? { id: { in: ids } } : {}) },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    select: {
      id: true, name: true, phone: true, patientBirth: true,
      date: true, time: true, status: true, createdAt: true,
      meta: true, package: { select: { title: true } },
    },
  });

  const wb = new Excel.Workbook();
  const ws = wb.addWorksheet("실시간 검진현황");

  // 너의 양식 헤더(요청 추가 포함)
  const HEADERS = [
    "고객사","수검자명","등급","생년월일","검진희망일","예약상태",
    "패키지타입","선택검사A","선택검사B","검사코드",
    "특수검진","특수물질","보건증","회사지원금","본인부담금",
    "복용약","병력","예약신청일"
  ];
  ws.addRow(HEADERS);

  rows.forEach(r => {
    const m: any = r.meta || {};
    const corp = m?.corpName || m?.corp || "";
    const grade = m?.grade || "기타";
    const pkgTitle = m?.packageName || r.package?.title || "";
    const wanted = toYMD(r.date);
    const selA = m?.examSnapshot?.selectedA || "";
    const selB = m?.examSnapshot?.selectedB || "";
    const codes = m?.examSnapshot?.examCodes || "";
    const support = Number(m?.companySupportKRW ?? 0) || 0;
    const coPay = Number(m?.coPayKRW ?? 0) || 0;
    const meds = (m?.meds ?? m?.form?.meds ?? "").toString().trim();
    const disease = (m?.disease ?? m?.form?.disease ?? "").toString().trim();

    ws.addRow([
      corp,
      r.name,
      grade,
      birth7toYMD(r.patientBirth),
      wanted,
      mapStatusKR(r.status),
      pkgTitle,
      selA,
      selB,
      codes,
      m?.specialExam || "",
      m?.specialMaterial || "",
      m?.healthCert ? "Y" : "N",
      support,
      coPay,
      meds ? meds : "없음",
      disease ? disease : "없음",
      toYMD(r.createdAt as Date),
    ]);
  });

  ws.columns.forEach(c => { c.width = Math.min(40, Math.max(12, (c.header as string)?.length || 12)); });

  const buf = await wb.xlsx.writeBuffer();
  const ymd = toYMD(new Date()).replaceAll("-", "");
  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="실시간_검진현황_${ymd}_${hosp.slug}.xlsx"`,
    },
  });
}



