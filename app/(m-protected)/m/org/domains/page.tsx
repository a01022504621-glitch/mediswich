// app/(m-protected)/m/org/domains/page.tsx
import prisma from "@/lib/prisma-scope";
import { requireOrg } from "@/lib/auth";
import crypto from "crypto";

type DomainRow = Awaited<ReturnType<typeof prisma.hospitalDomain.findMany>>[number];

function tokenFor(host: string, hospitalId: string) {
  const salt = process.env.DOMAIN_VERIFY_SALT || "dev-salt";
  return crypto.createHash("sha256").update(`${hospitalId}::${host}::${salt}`).digest("hex");
}

function nameFor(host: string) {
  return `_ms-verify.${host}`;
}

async function addableHosts(hospitalId: string) {
  // 중복 방지용 샘플(필요시 강화)
  const rows: DomainRow[] = await prisma.hospitalDomain.findMany({ where: { hospitalId } });
  return rows.map((r: DomainRow) => r.host);
}

export default async function DomainsPage() {
  const org = await requireOrg(); // org.id == hospitalId
  const domains: DomainRow[] = await prisma.hospitalDomain.findMany({
    where: { hospitalId: org.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-3xl p-6">
      <h1 className="text-2xl font-bold tracking-tight mb-3">커스텀 도메인</h1>
      <p className="text-sm text-slate-600 mb-6">
        병원 전용 주소를 연결합니다. DNS에 TXT 레코드를 추가해 소유권을 인증할 수 있어요.
      </p>

      <form
        action={async (formData) => {
          "use server";
          const host = String(formData.get("host") || "").trim().toLowerCase();
          if (!host || !host.includes(".")) throw new Error("도메인을 정확히 입력하세요.");
          // 중복 체크
          const exists = await prisma.hospitalDomain.findUnique({ where: { host } });
          if (exists && exists.hospitalId !== org.id) throw new Error("이미 다른 병원에서 사용 중인 도메인입니다.");
          if (!exists) {
            await prisma.hospitalDomain.create({
              data: { hospitalId: org.id, host },
            });
          }
        }}
        className="rounded-2xl border bg-white shadow-sm p-4 mb-6"
      >
        <label className="block text-sm font-medium text-slate-700 mb-1">도메인 추가</label>
        <div className="flex gap-2">
          <input
            name="host"
            placeholder="reserve.example.com"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:opacity-90">추가</button>
        </div>
        <p className="text-xs text-slate-500 mt-2">예: reserve.hospital.co.kr</p>
      </form>

      <div className="space-y-3">
        {domains.map((d: DomainRow) => {
          const token = tokenFor(d.host, org.id as any);
          const txtName = nameFor(d.host);
          return (
            <div key={d.id} className="rounded-2xl border bg-white shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{d.host}</div>
                  <div className="text-xs text-slate-500">
                    {d.verifiedAt ? (
                      <>인증됨: {new Date(d.verifiedAt).toLocaleString()}</>
                    ) : (
                      <>미인증</>
                    )}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    // no-op: 결정적 토큰이므로 request-verify 호출 없이도 안내 가능
                  }}
                >
                  <button
                    formAction="/api/org/domains/check-txt"
                    formMethod="post"
                    name="host"
                    value={d.host}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    인증 확인
                  </button>
                </form>
              </div>

              {!d.verifiedAt && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="font-medium mb-1">DNS에 아래 TXT 레코드를 추가하세요</div>
                  <div className="grid gap-1">
                    <div>
                      <span className="text-slate-500">Name</span>: <code>{txtName}</code>
                    </div>
                    <div>
                      <span className="text-slate-500">Type</span>: TXT
                    </div>
                    <div>
                      <span className="text-slate-500">Value</span>: <code>{token}</code>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">추가 후 “인증 확인”을 클릭하면 자동으로 검증됩니다.</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {domains.length === 0 && (
          <div className="text-slate-500 text-sm">등록된 도메인이 없습니다. 위 폼에서 도메인을 추가해 주세요.</div>
        )}
      </div>
    </main>
  );
}


