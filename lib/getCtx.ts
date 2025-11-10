// lib/getCtx.ts
// DEPRECATED: 과거 DB Session 조회 → JWT 기반 컨텍스트 헬퍼로 교체.
// 이 파일을 임포트하는 기존 코드 호환을 위해 유지합니다.

import { optionalSession } from "@/lib/auth/guard";

export async function getCtx() {
  const s = await optionalSession();
  if (!s) return null;
  const hid = s.hid || s.hospitalId || "";
  if (!hid) return null;
  return {
    hid,
    hospitalId: hid,
    uid: s.sub,
    role: s.role,
    hospitalSlug: s.hospitalSlug,
  };
}



