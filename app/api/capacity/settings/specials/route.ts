import { NextResponse } from "next/server";

type Special = { id: string; name: string };
type Store = { specials: Special[] };

function ensure(): Store {
  const g = globalThis as any;
  if (!g.__capacitySpecials || !Array.isArray(g.__capacitySpecials.specials)) {
    g.__capacitySpecials = {
      specials: [
        { id: "egd_sed",   name: "위내시경(수면)" },
        { id: "colon_sed", name: "대장내시경(수면)" },
        { id: "egd_awake", name: "위내시경(비수면)" },
      ],
    } as Store;
  }
  return g.__capacitySpecials as Store;
}

export async function GET() {
  const S = ensure();
  return NextResponse.json({ items: S.specials });
}

/** PUT body
 *  - { set: Special[] }     // 전체 교체
 *  - { add: Special }       // 1건 추가
 *  - { removeIds: string[] }  // 여러 건 삭제
 */
export async function PUT(req: Request) {
  const S = ensure();
  const body = await req.json().catch(() => ({}));

  const norm = (x: any): Special | null =>
    x && typeof x.id === "string" && typeof x.name === "string" ? { id: x.id, name: x.name } : null;

  if (Array.isArray(body.set)) {
    const arr = body.set.map(norm).filter(Boolean) as Special[];
    S.specials = arr;
  } else if (body.add) {
    const v = norm(body.add);
    if (v && !S.specials.some((s) => s.id === v.id)) S.specials.push(v);
  } else if (Array.isArray(body.removeIds)) {
    const del = new Set(body.removeIds.map(String));
    S.specials = S.specials.filter((s) => !del.has(s.id));
  }

  return NextResponse.json({ items: S.specials });
}

