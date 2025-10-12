// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const me = await requireSession().catch(() => null);
  if (!me) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!newPassword || String(newPassword).length < 8) {
    return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: me.sub } });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const ok = await bcrypt.compare(String(currentPassword || ""), user.password);
  if (!ok) return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });

  const hash = await bcrypt.hash(String(newPassword), 10);
  await prisma.user.update({
    where: { id: me.sub },
    data: { password: hash, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}

