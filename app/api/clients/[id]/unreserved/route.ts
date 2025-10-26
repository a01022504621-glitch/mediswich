// app/api/clients/[id]/unreserved/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma, { runAs } from "@/lib/prisma-scope";
import { getCtx } from "@/lib/tenant";
import { BookingStatus } from "@prisma/client";

type Participant = { name: string; phone: string; dept?: string | null; supportYn?: "Y" | "N"; supportAmt?: number };

const LIVE_STATUSES: BookingStatus[] = [
  BookingStatus.RESERVED,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

const norm = (s: string) => String(s ?? "").replace(/\D/g, "").slice(0, 11);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { hid } = await getCtx();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") || "50")));

  const client = await runAs(hid, () =>
    prisma.client.findFirst({
      where: { id: params.id, hospitalId: hid },
      select: { id: true, name: true, startDate: true, endDate: true, code: true, directUrl: true, participants: true },
    })
  );
  if (!client) return NextResponse.json({ message: "Not Found" }, { status: 404 });

  const all: Participant[] = Array.isArray(client.participants) ? (client.participants as any) : [];
  const filtered = all.filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(p?.name ?? "").toLowerCase().includes(s) ||
      String(p?.phone ?? "").includes(q) ||
      String((p as any)?.dept ?? "").toLowerCase().includes(s)
    );
  });

  const phones = Array.from(new Set(filtered.map((p) => norm(p.phone)).filter(Boolean)));
  let booked = new Set<string>();
  if (phones.length) {
    const bookings = await runAs(hid, () =>
      prisma.booking.findMany({
        where: {
          hospitalId: hid,
          phone: { in: phones },
          ...(client.startDate ? { date: { gte: client.startDate } } : {}),
          ...(client.endDate ? { date: { lte: client.endDate } } : {}),
          status: { in: LIVE_STATUSES },
        },
        select: { phone: true },
      })
    );
    booked = new Set(bookings.map((b) => norm(b.phone)));
  }

  const unreserved = filtered
    .filter((p) => !booked.has(norm(p.phone)))
    .map((p) => ({ name: p.name, phone: p.phone, dept: (p as any)?.dept ?? null, status: "미예약" }));

  const total = unreserved.length;
  const start = (page - 1) * pageSize;
  const items = unreserved.slice(start, start + pageSize);

  const deadline = client.endDate ? client.endDate.toISOString().slice(0, 10) : "";
  const urlForClient = client.directUrl || (client.code ? `${url.origin}/?corp=${encodeURIComponent(client.code)}` : "");

  return NextResponse.json({
    client: { id: client.id, name: client.name, url: urlForClient, deadline },
    items,
    total,
    page,
    pageSize,
  });
}



