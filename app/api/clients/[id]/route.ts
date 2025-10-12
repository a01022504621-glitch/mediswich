// app/api/clients/[id]/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCtx } from "@/lib/tenant";

type Participant = {
  name: string;
  phone: string;
  supportYn?: "Y" | "N";
  supportAmt?: number;
};

const d = (v?: Date | null) => (v ? v.toISOString().slice(0, 10) : "");
const yes = (v: any) =>
  String(v ?? "").trim().toLowerCase() === "y" ||
  String(v ?? "").trim().toLowerCase() === "yes" ||
  String(v ?? "").trim().toLowerCase() === "true" ||
  String(v ?? "").trim() === "1";
const normalizePhone = (s: string) => String(s ?? "").replace(/\D/g, "").slice(0, 11);

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const { hid } = await getCtx();
  const url = new URL(req.url);
  const view = url.searchParams.get("view");

  const c = await prisma.client.findFirst({
    where: { id: ctx.params.id, hospitalId: hid },
    select: {
      id: true,
      name: true,
      contact: true,
      startDate: true,
      endDate: true,
      memo: true,
      code: true,
      directUrl: true,
      createdAt: true,
      participantsCount: true,
      participants: true,
    },
  });
  if (!c) return NextResponse.json({ message: "Not Found" }, { status: 404 });

  // 페이징된 참여자
  if (view === "participants") {
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || "10"));
    const all = (c.participants as any[]) || [];
    const total = all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize) as Participant[];
    return NextResponse.json({ items, total, page, pageSize });
  }

  // 상세
  return NextResponse.json({
    id: c.id,
    name: c.name,
    contact: c.contact ?? "",
    startDate: d(c.startDate),
    endDate: d(c.endDate),
    memo: c.memo ?? "",
    corpCode: c.code ?? "",
    directUrl: c.directUrl ?? "",
    createdAt: c.createdAt.toISOString(),
    participants: c.participantsCount ?? 0,
  });
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const { hid } = await getCtx();
  const id = ctx.params.id;

  // 권한 범위 확인
  const exists = await prisma.client.findFirst({
    where: { id, hospitalId: hid },
    select: { id: true, participants: true, participantsCount: true },
  });
  if (!exists) return NextResponse.json({ message: "Not Found" }, { status: 404 });

  const ctype = req.headers.get("content-type") || "";

  // 엑셀/CSV 일괄 추가
  if (ctype.includes("multipart/form-data")) {
    const form = await (req as any).formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const fname = (file as any)?.name?.toLowerCase?.() || "upload";

    let rows: any[] = [];
    if (fname.endsWith(".csv")) {
      const text = buf.toString("utf8");
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length) {
        const headers = lines[0].split(",").map((h) => h.trim());
        for (const line of lines.slice(1)) {
          const cols = line.split(",");
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
          rows.push(obj);
        }
      }
    } else {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
    }

    // 맵핑
    const key = (k: string) => String(k).replace(/\s+/g, "").toLowerCase();
    const mapped: Participant[] = rows.map((r) => {
      const o = Object.fromEntries(Object.entries(r).map(([k, v]) => [key(k), v]));
      const name = String(o["이름"] ?? o["name"] ?? "").trim();
      const phone = normalizePhone(String(o["전화번호"] ?? o["phone"] ?? ""));
      const support = o["지원여부"] ?? o["support"];
      const amount = String(o["지원금"] ?? o["amount"] ?? "0").replace(/[^0-9.-]/g, "");
      return {
        name,
        phone,
        supportYn: yes(support) ? "Y" : "N",
        supportAmt: Number(amount) || 0,
      };
    });

    const valid = mapped.filter((m) => m.name && m.phone);
    const prev = ((exists.participants as any[]) || []) as Participant[];
    const next = [...prev, ...valid];

    await prisma.client.update({
      where: { id },
      data: { participants: next, participantsCount: next.length },
    });

    return NextResponse.json(
      { inserted: valid.length, received: mapped.length, skipped: mapped.length - valid.length },
      { status: 201 },
    );
  }

  // 단건 JSON 추가
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  if (!name || !phone) return NextResponse.json({ error: "name/phone required" }, { status: 400 });

  const p: Participant = {
    name,
    phone,
    supportYn: yes(body.support ?? body.supportYn) ? "Y" : "N",
    supportAmt: Number(body.amount ?? body.supportAmt ?? 0) || 0,
  };

  const prev = ((exists.participants as any[]) || []) as Participant[];
  const next = [p, ...prev];

  await prisma.client.update({
    where: { id },
    data: { participants: next, participantsCount: next.length },
  });

  return NextResponse.json(p, { status: 201 });
}

