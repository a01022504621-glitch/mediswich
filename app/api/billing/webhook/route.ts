// app/api/billing/webhook/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * 범용 PG 웹훅 엔드포인트
 * - 서명 헤더: x-ms-signature (HMAC-SHA256, body 전체의 hex)
 * - payload 예시:
 *   { "event":"invoice.paid", "invoiceId":"...", "hospitalId":"...", "amountKRW":70000 }
 *   { "event":"payment.failed", "hospitalId":"...", "reason":"..." }
 */

function verifySignature(raw: string, sig?: string | null) {
  const secret = process.env.WEBHOOK_SECRET || "";
  if (!secret || !sig) return false;
  const h = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  // 고정시간 비교
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig));
}

// 유틸: 기간 +1개월
function addOneMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-ms-signature");
  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const event = String(body.event || "");
  const hospitalId = body.hospitalId as string | undefined;
  const invoiceId = body.invoiceId as string | undefined;
  const amountKRW = Number(body.amountKRW ?? 0);

  try {
    if (event === "invoice.paid" || event === "payment.paid") {
      let hid = hospitalId;

      // 1) 인보이스가 주어진 경우 우선 갱신
      if (invoiceId) {
        const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!inv) throw new Error("invoice not found");
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { status: "PAID", paidAt: new Date() },
        });
        hid = inv.hospitalId;
      }

      if (!hid) throw new Error("hospitalId required");

      // 2) 구독 기간 연장
      const sub = await prisma.hospitalSubscription.findFirst({
        where: { hospitalId: hid, status: "ACTIVE" },
      });
      if (!sub) throw new Error("active subscription not found");

      const base = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
      const nextEnd = addOneMonth(base);
      await prisma.hospitalSubscription.update({
        where: { id: sub.id },
        data: { currentPeriodEnd: nextEnd },
      });

      // 3) (옵션) 새 인보이스 발행(다음 청구 주기용)
      if (!invoiceId) {
        await prisma.invoice.create({
          data: {
            hospitalId: hid,
            periodStart: base,
            periodEnd: nextEnd,
            amountKRW: amountKRW > 0 ? amountKRW : sub ? 0 : 0,
            status: "PAID",
            issuedAt: new Date(),
            paidAt: new Date(),
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (event === "invoice.failed" || event === "payment.failed") {
      if (!hospitalId) throw new Error("hospitalId required");
      // 구독 상태를 PAST_DUE로 전환(운영 정책에 맞게 변경 가능)
      await prisma.hospitalSubscription.updateMany({
        where: { hospitalId, status: "ACTIVE" },
        data: { status: "PAST_DUE" },
      });
      return NextResponse.json({ ok: true });
    }

    // 기타 이벤트 무시
    return NextResponse.json({ ok: true, ignored: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}

