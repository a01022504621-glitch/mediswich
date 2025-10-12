// lib/auth/guard.ts
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, type JwtPayload, COOKIE_NAME } from "@/lib/auth/jwt";

// 현재 요청의 경로(로그인 후 복귀용) 추출
function currentPathForNext(): string | undefined {
  const h = headers();
  const url = h.get("x-url") || h.get("referer") || undefined;
  try {
    if (!url) return undefined;
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return undefined;
  }
}

export type Session = JwtPayload & {
  sub: string;
  role?: string;
  hospitalId?: string;
  hospitalSlug?: string;
  hid?: string; // alias
};

// ALS 컨텍스트 주입 헬퍼 (enterTenant/setTenant 둘 다 지원)
async function primeTenantContext(payload: Session) {
  try {
    const als = await import("@/lib/tenant/als");
    const ctx = {
      hospitalId: payload.hospitalId || payload.hid || "",
      hospitalSlug: payload.hospitalSlug,
      uid: payload.sub,
      role: payload.role,
    };
    if (!ctx.hospitalId) return;
    if (typeof (als as any).enterTenant === "function") {
      (als as any).enterTenant(ctx);
    } else if (typeof (als as any).setTenant === "function") {
      (als as any).setTenant(ctx);
    } else if (als && typeof (als as any).runWithTenant === "function") {
      // 최후의 수단: 동기 enter가 없으면 run으로 감싸기 (호출자 직후에만 유효)
      (als as any).runWithTenant(ctx, () => {});
    }
  } catch {
    // ALS 미존재 시 무시 (프리스마 미들웨어가 없으면 스코프 미적용)
  }
}

export async function optionalSession(): Promise<Session | null> {
  const c = cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = (await verifyJwt(token)) as Session;
    if (payload?.hospitalId && !payload.hid) payload.hid = payload.hospitalId;
    // ALS priming
    await primeTenantContext(payload);
    return payload;
  } catch {
    return null;
  }
}

export async function requireSession(opts?: { next?: string }) {
  const c = cookies();
  const token = c.get(COOKIE_NAME)?.value;

  const next = opts?.next ?? currentPathForNext() ?? "/m/dashboard";
  const loginUrl = `/m/login?next=${encodeURIComponent(next)}`;

  if (!token) redirect(loginUrl);

  try {
    const payload = (await verifyJwt(token)) as Session;
    if (!payload?.sub) throw new Error("Invalid session");
    if (payload.hospitalId && !payload.hid) payload.hid = payload.hospitalId;

    // ALS priming: 이후의 Prisma 쿼리에 병원 스코프 자동 적용
    await primeTenantContext(payload);

    return payload;
  } catch {
    redirect(loginUrl);
  }
}

export function assertRole(s: Session, roles: string[] | readonly string[]) {
  if (!s?.role || !roles.includes(s.role)) {
    throw new Error("FORBIDDEN");
  }
}

export async function requireRole(roles: string[] | readonly string[]) {
  const s = await requireSession();
  assertRole(s, roles);
  return s;
}

