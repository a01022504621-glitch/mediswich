import { NextResponse } from "next/server";

type Special = { id: string; name: string };
type Store = { specials: Special[] };

// 전역 메모리 저장소. 하드코딩 없음.
function ensure(): Store {
  const g = globalThis as any;
  if (!g.__capacitySpecials || !Array.isArray(g.__capacitySpecials.specials)) {
    g.__capacitySpecials = { specials: [] } as Store;
  }
  return g.__capacitySpecials as Store;
}

export async function GET() {
  const S = ensure();
  return NextResponse.json({ items: S.specials });
}

/** PUT body 예시
 * { set: Special[] } | { add: Special } | { removeIds: string[] }
 */
export async function PUT(req: Request) {
  const S = ensure();
  const body = await req.json().catch(() => ({}));

  const norm = (x: any): Special | null =>
    x && typeof x.id === "string" && typeof x.name === "string" ? { id: x.id, name: x.name } : null;

  if (Array.isArray(body.set)) {
    S.specials = body.set.map(norm).filter(Boolean) as Special[];
  } else if (body.add) {
    const v = norm(body.add);
    if (v && !S.specials.some((s) => s.id === v.id)) S.specials.push(v);
  } else if (Array.isArray(body.removeIds)) {
    const del = new Set(body.removeIds.map(String));
    S.specials = S.specials.filter((s) => !del.has(s.id));
  }

  return NextResponse.json({ items: S.specials });
}



