export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// mediswich/app/api/clients/options/route.ts
 
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireOrg } from "@/lib/auth";

export async function GET() {
  try {
    const org = await requireOrg(); // 병원 스코프

    // 병원에 등록된 고객사만
    const rows = await prisma.client.findMany({
      where: { hospitalId: org.id },
      select: { id: true, name: true },
    });

    // ㄱㄴㄷ 정렬
    const items = (rows || [])
      .map((x) => ({ id: String(x.id), name: String(x.name || "").trim() }))
      .filter((x) => x.name)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

