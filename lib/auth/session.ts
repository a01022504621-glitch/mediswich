// lib/auth/session.ts
import { getCtx } from "@/lib/tenant";

/** 프로젝트 전역에서 쓰는 requireSession: 병원 컨텍스트가 반드시 있어야 함 */
export type SessionLike = {
  hid: string;             // hospital id (필수)
  [k: string]: any;        // 나머지는 getCtx()가 돌려주는 값 그대로
};

export async function requireSession(): Promise<SessionLike> {
  const ctx = await getCtx(); // 이미 관리자 레이아웃 등에서 쓰던 함수
  if (!ctx || !ctx.hid) {
    throw new Error("Unauthorized: No hospital in session");
  }
  return ctx as SessionLike;
}

/** 필요 시 선택형 세션 */
export async function getOptionalSession(): Promise<SessionLike | null> {
  try {
    const ctx = await getCtx();
    return ctx?.hid ? (ctx as SessionLike) : null;
  } catch {
    return null;
  }
}


