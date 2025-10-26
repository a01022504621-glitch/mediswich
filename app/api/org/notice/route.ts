export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/org/notice/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth/session";

async function getHid() {
  const sess = await requireSession();
  const hid = (sess as any)?.hid ?? (sess as any)?.hospitalId;
  if (!hid) throw new Error("No hospital in session");
  return hid as string;
}

// very basic sanitization: strip <script> blocks
function sanitize(html: string) {
  return String(html ?? "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

// GET: 현재 공지 조회
export async function GET() {
  try {
    const hid = await getHid();
    const hospital = await prisma.hospital.findUnique({
      where: { id: hid },
      select: { noticeHtml: true },
    });
    return NextResponse.json({ noticeHtml: hospital?.noticeHtml ?? "" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

// PUT: 공지 저장
export async function PUT(req: Request) {
  try {
    const hid = await getHid();
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.noticeHtml === "string" ? body.noticeHtml : "";
    if (raw.length > 100_000) {
      return NextResponse.json({ error: "HTML too large" }, { status: 413 });
    }
    const cleaned = sanitize(raw);

    await prisma.hospital.update({
      where: { id: hid },
      data: { noticeHtml: cleaned },
    });

    return NextResponse.json({ ok: true, noticeHtml: cleaned });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}



