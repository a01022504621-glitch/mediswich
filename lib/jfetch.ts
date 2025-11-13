// lib/jfetch.ts
type Inflight = { p: Promise<any>; c: AbortController; t: number };
const inflight = new Map<string, Inflight>();

/**
 * JSON GET with in-flight dedupe + abort older + soft TTL result.
 * - 같은 URL이 dedupeMs 내에 또 호출되면 동일 Promise를 반환
 * - 더 오래된 동일 URL 요청은 Abort
 */
export async function jget<T>(
  url: string,
  { dedupeMs = 400 }: { dedupeMs?: number } = {}
): Promise<T | null> {
  const now = Date.now();
  const prev = inflight.get(url);

  // 같은 URL이 아직 살아있고, dedupe 시간 이내면 그 Promise 재사용
  if (prev && now - prev.t < dedupeMs) return prev.p;

  // 이전 in-flight가 있으면 취소(더 오래된 요청 제거)
  if (prev) prev.c.abort("replaced-by-newer-request");

  const c = new AbortController();
  const p = fetch(url, { cache: "no-store", signal: c.signal })
    .then(async (r) => {
      // 200이더라도 JSON ok 필드 확인
      const j = await r.json().catch(() => null);
      return j && j.ok ? (j as T) : null;
    })
    .finally(() => {
      // 잠깐 유지 후 맵에서 제거(바로 지우면 레이스로 또 붙을 수 있음)
      setTimeout(() => inflight.delete(url), dedupeMs);
    });

  inflight.set(url, { p, c, t: now });
  return p;
}

/** 쿼리스트링 빌더 */
export const qs = (o: Record<string, any>) =>
  Object.entries(o)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

