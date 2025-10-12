// /app/(r-public)/r/[tenant]/reserve/page.tsx
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { allow } from "@/lib/rate/limiter";
import { requireActiveSubscription } from "@/lib/subscription";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ipFromHeaders() {
  const h = headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || "0.0.0.0";
}
function normalizePhone(raw: string) {
  const d = raw.replace(/\D+/g, "");
  if (d.length === 10) return d.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  if (d.length === 11) return d.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  return raw;
}

export default async function TenantReserve({
  params,
  searchParams,
}: {
  params: { tenant: string };
  searchParams: { packageId?: string; time?: string; date?: string };
}) {
  const host = headers().get("x-forwarded-host") ?? headers().get("host") ?? "";
  const t = await resolveTenantHybrid({ slug: params.tenant, host });
  if (!t) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">잘못된 병원 주소</h1>
        <p className="text-slate-600">병원을 찾을 수 없습니다.</p>
      </main>
    );
  }
  const tenantId = t.id;
  const tenantSlug = t.slug;

  const h = await prisma.hospital.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  if (!h) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">잘못된 병원 주소</h1>
        <p className="text-slate-600">병원을 찾을 수 없습니다.</p>
      </main>
    );
  }

  const pkg = searchParams.packageId
    ? await prisma.package.findFirst({
        where: { id: searchParams.packageId, hospitalId: tenantId, visible: true },
      })
    : null;

  const sub = await prisma.hospitalSubscription.findFirst({
    where: { hospitalId: tenantId, status: "ACTIVE" },
  });
  const subscriptionExpired = sub ? sub.currentPeriodEnd < new Date() : false;

  async function createBooking(formData: FormData) {
    "use server";
    const ip = ipFromHeaders();
    if (!allow(`reserve:${ip}`, 5, 60_000)) throw new Error("요청이 많습니다. 잠시 후 다시 시도해주세요.");

    const packageId = String(formData.get("packageId") || "");
    const dateStr = String(formData.get("date") || "");
    const time = String(formData.get("time") || "");
    const name = String(formData.get("name") || "");
    const phone = normalizePhone(String(formData.get("phone") || ""));
    if (!packageId || !name || !phone) throw new Error("유효하지 않은 입력");
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new Error("유효한 날짜를 선택해주세요.");

    await requireActiveSubscription(tenantId);

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, hospitalId: tenantId, visible: true },
    });
    if (!pkg) throw new Error("상품을 찾을 수 없습니다.");

    const concurrent = await prisma.booking.count({
      where: { hospitalId: tenantId, date, time },
    });
    const tpl = await prisma.slotTemplate.findFirst({
      where: { hospitalId: tenantId, dow: date.getDay(), start: time },
    });
    const capacity = tpl?.capacity ?? 1;
    if (concurrent >= capacity) throw new Error("해당 시간은 예약이 마감되었습니다.");

    await prisma.booking.create({
      data: {
        hospitalId: tenantId,
        packageId,
        date,
        time,
        name,
        phone,
        phoneNormalized: phone.replace(/\D+/g, ""),
        status: "CONFIRMED",
      },
    });
    revalidatePath(`/r/${tenantSlug}`);
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{h.name} - 예약 정보 입력</h1>
      </header>

      {!pkg && (
        <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
          상품이 선택되지 않았습니다.
        </p>
      )}
      {subscriptionExpired && (
        <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
          현재 병원의 구독이 만료되어 예약이 제한될 수 있습니다.
        </p>
      )}

      {pkg && (
        <div className="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-[11px] tracking-wide text-slate-500">선택된 상품</div>
          <div className="mt-1 font-semibold text-slate-900">{pkg.title}</div>
          <div className="mt-1 text-sm text-slate-600">{pkg.summary ?? ""}</div>
        </div>
      )}

      <form action={createBooking} className="grid max-w-xl gap-3">
        <input type="hidden" name="packageId" value={pkg?.id ?? ""} />

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">예약일</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={String(searchParams.date ?? "")}
            className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">시간</span>
          <input
            name="time"
            placeholder="10:30"
            defaultValue={String(searchParams.time ?? "")}
            className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">이름</span>
          <input
            name="name"
            required
            className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">휴대폰</span>
          <input
            name="phone"
            required
            inputMode="tel"
            className="rounded-2xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <button
          className="mt-1 w-40 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:bg-slate-300"
          disabled={!pkg || subscriptionExpired}
        >
          예약 확정
        </button>
      </form>

      <a href={`/r/${tenantSlug}`} className="mt-3 inline-block text-sm text-slate-600 underline">
        ← 예약자 랜딩으로
      </a>
    </main>
  );
}


