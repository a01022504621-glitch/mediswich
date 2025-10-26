// app/api/capacity/day/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

type Resource = "basic" | "egd" | "col";

export async function PUT(req: NextRequest) {
  try {
    const { date: rawDate, close: closeIn, resource: rawRes } = await req.json().catch(() => ({} as any));
    const date = String(rawDate || "").trim();           // "YYYY-MM-DD"
    const close: boolean = !!closeIn;
    const resource: Resource = rawRes === "egd" || rawRes === "col" ? rawRes : "basic";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
    }

    // 병원 스코프 강제
    const s = await requireSession();            // 미인증이면 401 던짐
    const hospitalId = s.hid ?? (s as any).hospitalId;
    if (!hospitalId) return NextResponse.json({ ok: false, error: "HOSPITAL_NOT_SELECTED" }, { status: 401 });

    const d = new Date(date + "T00:00:00");

    if (resource === "basic") {
      if (close) {
        await runAs(hospitalId, () =>
          prisma.slotException.upsert({
            where: { hospitalId_date: { hospitalId, date: d } },
            create: { hospitalId, date: d },
            update: {}, // 이미 있으면 유지
          })
        );
      } else {
        await runAs(hospitalId, async () => {
          try {
            await prisma.slotException.delete({ where: { hospitalId_date: { hospitalId, date: d } } });
          } catch {
            // 없으면 무시
          }
        });
      }
    } else {
      const type = resource === "egd" ? "EGD" : "COL";
      if (close) {
        await runAs(hospitalId, () =>
          prisma.capacityOverride.upsert({
            where: { hospitalId_date_type: { hospitalId, date: d, type } },
            create: { hospitalId, date: d, type, isClosed: true },
            update: { isClosed: true },
          })
        );
      } else {
        await runAs(hospitalId, async () => {
          try {
            await prisma.capacityOverride.delete({ where: { hospitalId_date_type: { hospitalId, date: d, type } } });
          } catch {
            await prisma.capacityOverride.upsert({
              where: { hospitalId_date_type: { hospitalId, date: d, type } },
              create: { hospitalId, date: d, type, isClosed: false },
              update: { isClosed: false },
            });
          }
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL" }, { status: 500 });
  }
}



