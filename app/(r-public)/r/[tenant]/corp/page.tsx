import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

export default async function CorpPage({
  params,
  searchParams,
}: {
  params: { tenant: string };
  searchParams: { code?: string };
}) {
  const host = headers().get("x-forwarded-host") ?? headers().get("host") ?? "";
  const t = await resolveTenantHybrid({ slug: params.tenant, host });
  if (!t) return <main className="mx-auto max-w-4xl p-6">존재하지 않는 병원입니다.</main>;

  const h = await prisma.hospital.findUnique({
    where: { id: t.id },
    select: { name: true, slug: true },
  });
  if (!h) return <main className="mx-auto max-w-4xl p-6">존재하지 않는 병원입니다.</main>;

  const code = (searchParams.code || "").trim();
  if (!code) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">{h.name} - 기업검진</h1>
        <p className="mt-2 text-red-600">기업코드를 입력해주세요.</p>
      </main>
    );
  }

  const client = await prisma.client.findFirst({
    where: { hospitalId: t.id, code: { equals: code, mode: "insensitive" } },
    select: { id: true, name: true, code: true },
  });

  if (!client) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">{h.name} - 기업검진</h1>
        <p className="mt-2 text-red-600">조회된 패키지가 없습니다. 기업코드를 다시 확인해주세요.</p>
      </main>
    );
  }

  const pkgs = await prisma.package.findMany({
    where: {
      hospitalId: t.id,
      category: "CORP",
      visible: true,
      OR: [{ clientId: client.id }, { clientId: null }],
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800 text-sm font-semibold">
        <span className="mr-2">기업코드</span>
        <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-blue-700">{client.code}</span>
        <span className="ml-3">·</span>
        <span className="ml-3">{client.name} 전용 기업검진</span>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pkgs.map((p) => (
          <li key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="font-semibold">{p.title}</div>
            {typeof p.price === "number" && (
              <div className="text-sm text-gray-600">{p.price.toLocaleString()}원</div>
            )}
            {p.summary && <div className="mt-2 line-clamp-2 text-sm text-gray-500">{p.summary}</div>}
            <a
              className="mt-3 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white"
              href={`/r/${t.slug}/schedule?packageId=${p.id}&code=${encodeURIComponent(
                client.code || ""
              )}&corpName=${encodeURIComponent(client.name || "")}`}
            >
              선택
            </a>
          </li>
        ))}
        {pkgs.length === 0 && <li>공개된 기업검진 상품이 없습니다.</li>}
      </ul>
    </main>
  );
}


