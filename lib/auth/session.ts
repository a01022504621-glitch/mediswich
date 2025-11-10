// lib/auth/session.ts
// DEPRECATED: 과거 DB 세션 기반 헬퍼 대체용 호환 래퍼.
// 전부 JWT 기반 guard로 위임합니다.

import {
  optionalSession as _optionalSession,
  requireSession as _requireSession,
  type Session,
} from "@/lib/auth/guard";

export type SessionLike = Session;

export async function requireSession(): Promise<SessionLike> {
  return _requireSession();
}

export async function getOptionalSession(): Promise<SessionLike | null> {
  return _optionalSession();
}


