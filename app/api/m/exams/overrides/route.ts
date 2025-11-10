export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// app/api/m/exams/overrides/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/guard";

/**
 * 전역 코드/성별 오버라이드
 * - 단위: 병원 × examId
 * - sex: 'A' | 'M' | 'F' | null
 */
type ItemIn = {
  examId: string;
  code?: string | null;
  sex?: "A" | "M" | "F" | null;
};

function normSex(v: any): "A" | "M" | "F" | null {
  if (v === "A" || v === "M" || v === "F") return v;
  return null;
}
function normCode(v: any): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

/** 목록 조회
 * GET /api/m/exams/overrides?examId=ex_xxx
 */
export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const url = new URL(req.url);
    const examId = (url.searchParams.get("examId") || "").trim();

    const rows = await prisma.examOverride.findMany({
      where: { hospitalId: hid, ...(examId ? { examId } : {}) },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        examId: r.examId,
        code: r.code ?? null,
        sex: (r.sexCode as "A" | "M" | "F" | null) ?? null,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}

/** 일괄 업서트
 * PUT /api/m/exams/overrides
 * body: { items: ItemIn[] }
 * - code, sex 둘 다 null/빈값이면 해당 examId 오버라이드 삭제
 */
export async function PUT(req: NextRequest) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const body = (await req.json().catch(() => ({}))) as { items?: ItemIn[] };

    const items = Array.isArray(body.items) ? body.items! : [];
    if (items.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0, deleted: 0 });
    }

    let upserted = 0;
    let deleted = 0;

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const examId = String(it.examId || "").trim();
        if (!examId) continue;

        const sex = normSex(it.sex);
        const code = normCode(it.code);

        // 둘 다 없으면 삭제
        if (!sex && !code) {
          const r = await tx.examOverride.deleteMany({ where: { hospitalId: hid, examId } });
          if (r.count > 0) deleted += r.count;
          continue;
        }

        await tx.examOverride.upsert({
          where: { hospitalId_examId: { hospitalId: hid, examId } },
          update: { sexCode: sex, code },
          create: { hospitalId: hid, examId, sexCode: sex, code },
        });
        upserted += 1;
      }

      await tx.auditLog.create({
        data: {
          hospitalId: hid,
          userId: s.sub ?? null,
          action: "UPSERT_EXAM_OVERRIDES",
          meta: { upserted, deleted },
        },
      });
    });

    return NextResponse.json({ ok: true, upserted, deleted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}

/** 삭제
 * DELETE /api/m/exams/overrides?examId=ex_xxx   → 단건 삭제
 * DELETE /api/m/exams/overrides                 → 전부 삭제(주의)
 */
export async function DELETE(req: NextRequest) {
  try {
    const s = await requireSession();
    const hid = s.hid!;
    const url = new URL(req.url);
    const examId = (url.searchParams.get("examId") || "").trim();

    const where = { hospitalId: hid, ...(examId ? { examId } : {}) };
    const r = await prisma.examOverride.deleteMany({ where });

    await prisma.auditLog.create({
      data: {
        hospitalId: hid,
        userId: s.sub ?? null,
        action: "DELETE_EXAM_OVERRIDES",
        meta: { examId: examId || "*", count: r.count },
      },
    });

    return NextResponse.json({ ok: true, deleted: r.count });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}



