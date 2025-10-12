// app/api/capacity/day/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const date: string = (body?.date || "").trim();          // "YYYY-MM-DD"
    const close: boolean = !!body?.close;                     // true: 마감, false: 해제
    const resource: "basic" | "egd" | "col" =
      body?.resource === "egd" || body?.resource === "col" ? body.resource : "basic";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
    }

    // 관리자 컨텍스트: 단일 병원 가정 (세션 유틸이 있다면 그걸 사용하세요)
    const hosp = await prisma.hospital.findFirst({ select: { id: true } });
    if (!hosp) return NextResponse.json({ ok: false, error: "HOSP_NOT_FOUND" }, { status: 404 });

    const d = new Date(date + "T00:00:00");

    // 기본(basic) 마감은 slotException(또는 dayClose)에 저장하고,
    // 특정(egd/col) 마감은 capacityOverride(type)에 저장하도록 분리
    if (resource === "basic") {
      if (close) {
        // 존재하지 않으면 생성
        await (prisma as any).slotException.upsert({
          where: { hospitalId_date: { hospitalId: hosp.id, date: d } },
          create: { hospitalId: hosp.id, date: d },
          update: {}, // 이미 있으면 유지
        });
      } else {
        // 해제: 기록 삭제
        try {
          await (prisma as any).slotException.delete({
            where: { hospitalId_date: { hospitalId: hosp.id, date: d } },
          });
        } catch {}
      }
    } else {
      const type = resource === "egd" ? "EGD" : "COL";
      if (close) {
        await (prisma as any).capacityOverride.upsert({
          where: { hospitalId_date_type: { hospitalId: hosp.id, date: d, type } },
          create: { hospitalId: hosp.id, date: d, type, isClosed: true },
          update: { isClosed: true },
        });
      } else {
        // 해제는 깔끔히 삭제(혹시 isClosed=false로 남아있다면 업데이트)
        try {
          await (prisma as any).capacityOverride.delete({
            where: { hospitalId_date_type: { hospitalId: hosp.id, date: d, type } },
          });
        } catch {
          await (prisma as any).capacityOverride.upsert({
            where: { hospitalId_date_type: { hospitalId: hosp.id, date: d, type } },
            create: { hospitalId: hosp.id, date: d, type, isClosed: false },
            update: { isClosed: false },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}


