// lib/rate/limiter.ts
// 간단한 메모리 레이트리밋(서버 재기동 시 초기화됨). 키 단위 슬라이딩 윈도우 유사 로직.
type Bucket = { count: number; reset: number; limit: number };
const buckets = new Map<string, Bucket>();

/**
 * allow(key, limit, windowMs)
 * - key: "reserve:IP", "verify:IP" 등 엔드포인트별로 분리
 * - limit: 윈도우 내 허용 횟수
 * - windowMs: 윈도우 길이(ms)
 * return: 허용 여부(true/false)
 */
export function allow(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key) ?? { count: 0, reset: now + windowMs, limit };
  if (now > b.reset) {
    b.count = 0;
    b.reset = now + windowMs;
    b.limit = limit;
  }
  b.count += 1;
  buckets.set(key, b);
  return b.count <= limit;
}
