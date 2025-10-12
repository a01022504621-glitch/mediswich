import { NextResponse } from "next/server";

type Store = {
  managed: { basic: boolean; nhis: boolean; special: boolean; exams: Set<string> };
  months: Map<string, any>;
};

function ensureStore(): Store {
  const g = globalThis as any;
  if (!g.__capacityStore) {
    g.__capacityStore = {
      managed: { basic: true, nhis: false, special: false, exams: new Set<string>() },
      months: new Map<string, any>(),
    } as Store;
  }
  return g.__capacityStore as Store;
}

export async function GET() {
  const st = ensureStore();
  return NextResponse.json({
    basic: st.managed.basic, nhis: st.managed.nhis, special: st.managed.special,
    exams: Array.from(st.managed.exams),
  });
}

/** PUT body: { basic?, nhis?, special?, set?: string[], add?: string[], remove?: string[] } */
export async function PUT(req: Request) {
  const st = ensureStore();
  const body = await req.json().catch(() => ({}));

  (["basic","nhis","special"] as const).forEach(k => {
    if (typeof body[k] === "boolean") (st.managed as any)[k] = body[k];
  });

  if (Array.isArray(body.set)) {
    st.managed.exams = new Set(body.set.map(String));   // ✅ 전체 덮어쓰기
  } else {
    if (Array.isArray(body.add))    for (const id of body.add)    st.managed.exams.add(String(id));
    if (Array.isArray(body.remove)) for (const id of body.remove) st.managed.exams.delete(String(id));
  }

  st.months.clear(); // 달력 재생성
  return NextResponse.json({
    basic: st.managed.basic, nhis: st.managed.nhis, special: st.managed.special,
    exams: Array.from(st.managed.exams),
  });
}
