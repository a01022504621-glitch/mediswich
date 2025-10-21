// app/api/m/packages/general/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = (globalThis as any).prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") (globalThis as any).prisma = prisma;

function getHid(req: NextRequest): string | null {
  const hid = req.nextUrl.searchParams.get("hid");
  return hid && hid.trim().length > 0 ? hid : null;
}

/** 관리자용: 병원 ID로 GENERAL 패키지 목록 조회(노출 여부 무관) */
export async function GET(req: NextRequest) {
  const hid = getHid(req);
  if (!hid) return NextResponse.json({ error: "hid required" }, { status: 400 });

  const items = await prisma.package.findMany({
    where: { hospitalId: hid, category: "GENERAL" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items, { headers: { "cache-control": "no-store" } });
}

/** 병원 단위 전체 삭제 */
export async function DELETE(req: NextRequest) {
  const hid = getHid(req);
  if (!hid) return NextResponse.json({ error: "hid required" }, { status: 400 });

  const r = await prisma.package.deleteMany({
    where: { hospitalId: hid, category: "GENERAL" },
  });
  return NextResponse.json({ deleted: r.count });
}

/** 단일 패키지 생성 */
export async function POST(req: NextRequest) {
  const hid = getHid(req);
  if (!hid) return NextResponse.json({ error: "hid required" }, { status: 400 });

  const body = await req.json();
  const period = body?.tags?.period || {};
  const startDate = period?.from ? new Date(period.from) : null;
  const endDate = period?.to ? new Date(period.to) : null;

  const created = await prisma.package.create({
    data: {
      hospitalId: hid,
      clientId: body?.clientId ?? null,
      title: body?.title ?? "",
      summary: body?.summary ?? null,
      price: body?.price ?? null,
      category: "GENERAL",
      visible: !!body?.visible,
      tags: body?.tags ?? {},
      startDate,
      endDate,
    },
  });
  return NextResponse.json(created);
}



