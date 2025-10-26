export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { getCtx } from "@/lib/tenant";

const d = (v?: Date | null) => (v ? v.toISOString().slice(0, 10) : "");

export async function GET(req: NextRequest) {
  const { hid } = await getCtx();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(parseInt(url.searchParams.get("take") || "50", 10), 100);

  const where: any = {
    hospitalId: hid,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { contact: { contains: q } },
            { directUrl: { contains: q } },
          ],
        }
      : {}),
  };

  // 드롭다운/검색용(기본: ClientSelect에서 사용) → { items: [...] }
  if (url.searchParams.has("take") || url.searchParams.get("lite") === "1") {
    const rows = await prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      take,
      select: { id: true, name: true, code: true },
    });
    return NextResponse.json({
      items: rows.map((r) => ({ id: r.id, name: r.name, code: r.code ?? "" })),
    });
  }

  // 등록 페이지 하단 리스트용 → Array 반환
  const rows = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      contact: true,
      startDate: true,
      endDate: true,
      code: true,
      directUrl: true,
      participantsCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      contact: r.contact ?? "",
      startDate: d(r.startDate),
      endDate: d(r.endDate),
      corpCode: r.code ?? "",
      directUrl: r.directUrl ?? "",
      participants: r.participantsCount ?? 0,
      createdAt: r.createdAt,
    })),
  );
}

export async function POST(req: NextRequest) {
  const { hid } = await getCtx();
  const body = await req.json().catch(() => ({} as any));

  const participantsArr = Array.isArray(body.participants) ? body.participants : [];
  const participantsCount = participantsArr.length;

  const created = await prisma.client.create({
    data: {
      hospitalId: hid,
      name: String(body.name ?? "").trim(),
      contact: body.contact || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      memo: body.memo || null,
      code: body.corpCode || null,
      directUrl: body.directUrl || null,
      participants: participantsArr.length ? participantsArr : undefined,
      participantsCount,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}



