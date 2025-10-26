export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/clients/[id]/notify/route.ts
// 선택한 대상자에게 알림톡(모의) 전송
type SendBody = {
  channel: "ALIMTALK";
  template?: string;   // 메시지 템플릿(예: "{name}님, {client}...")
  items: { name: string; phone: string }[];
  variables?: Record<string, string>; // { client, url, deadline, ... }
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const body = (await req.json().catch(() => null)) as SendBody | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "items required" }, { status: 400 });
  }

  const tpl = body.template || "{name}님, {client} 검진 예약이 필요합니다. 링크: {url}";
  const vars = body.variables || {};

  // 실제 연동: 여기서 카카오톡 Biz API 호출로 교체
  // 지금은 모의 전송(0.2초 지연)으로 성공 처리
  const results = [];
  for (const it of body.items) {
    await sleep(200);
    const msg = tpl
      .replace(/{name}/g, it.name || "")
      .replace(/{phone}/g, it.phone || "")
      .replace(/{client}/g, vars.client || "")
      .replace(/{url}/g, vars.url || "")
      .replace(/{deadline}/g, vars.deadline || "");
    results.push({ to: it.phone, name: it.name, ok: true, message: msg });
  }

  return Response.json({
    ok: true,
    count: results.length,
    results,
  });
}

