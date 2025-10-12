// lib/subscription.ts
import { prisma } from "@/lib/prisma";

/** 개발/스테이징에서는 구독 가드를 느슨하게 */
function isProd() {
  const env = process.env.APP_ENV || process.env.NODE_ENV;
  return env === "prod" || env === "production";
}

/** 병원 구독 조회(활성 + 기간 유효) */
export async function getActiveSubscription(hospitalId: string) {
  const sub = await prisma.hospitalSubscription.findFirst({
    where: { hospitalId, status: "ACTIVE" },
    include: { plan: true },
  });
  if (!sub) return null;
  if (sub.currentPeriodEnd < new Date()) return null;
  return sub;
}

/** 페이지/액션 접근 전 체크 */
export async function requireActiveSubscription(hospitalId: string) {
  if (!isProd()) return; // dev/staging은 통과
  const bypass = process.env.SUBSCRIPTION_BYPASS === "1";
  if (bypass) return;

  const sub = await getActiveSubscription(hospitalId);
  if (!sub) {
    const err: any = new Error("SUBSCRIPTION_INACTIVE");
    err.code = "SUBSCRIPTION_INACTIVE";
    throw err;
  }
}

/** 플랜 기능 토글: Plan.features(JSON)의 boolean 키 */
export async function hasFeature(hospitalId: string, featureKey: string): Promise<boolean> {
  if (!isProd()) return true;
  const sub = await getActiveSubscription(hospitalId);
  if (!sub) return false;
  const features = (sub.plan?.features as any) || {};
  const v = features[featureKey];
  return Boolean(v);
}

