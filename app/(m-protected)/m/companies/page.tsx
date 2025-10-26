// app/(m-protected)/m/companies/page.tsx
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

type CompanyRow = Awaited<ReturnType<typeof prisma.company.findMany>>[number];

export default async function CompaniesPage() {
  const s = await requireSession();
  const hid = s.hid!;

  const items: CompanyRow[] = await prisma.company.findMany({
    where: { hospitalId: hid },
    orderBy: { createdAt: "desc" },
  });

  async function createCompany(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    if (!name) return;

    const token = crypto.randomBytes(12).toString("hex");
    await prisma.company.create({ data: { name, token, hospitalId: hid } });
    await prisma.auditLog.create({
      data: { hospitalId: hid, userId: s.sub, action: "CREATE_COMPANY", meta: { name } },
    });
    revalidatePath("/m/companies");
  }

  async function deleteCompany(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const r = await prisma.company.deleteMany({ where: { id, hospitalId: hid } });
    if (r.count > 0) {
      await prisma.auditLog.create({
        data: { hospitalId: hid, userId: s.sub, action: "DELETE_COMPANY", meta: { id } },
      });
    }
    revalidatePath("/m/companies");
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>회사</h1>

      <form action={createCompany} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          name="name"
          placeholder="회사명"
          required
          style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}
        />
        <button style={{ borderRadius: 8, padding: "8px 12px", background: "#111827", color: "#fff" }}>
          추가
        </button>
      </form>

      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              회사명
            </th>
            <th style={{ textAlign: "left", padding: 8, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              토큰
            </th>
            <th style={{ textAlign: "left", padding: 8, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              액션
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((c: CompanyRow) => (
            <tr key={c.id}>
              <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>{c.name}</td>
              <td
                style={{
                  padding: 8,
                  borderBottom: "1px solid #e5e7eb",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              >
                {c.token}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>
                <form action={deleteCompany}>
                  <input type="hidden" name="id" value={c.id} />
                  <button style={{ color: "#dc2626" }}>삭제</button>
                </form>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td style={{ padding: 8 }} colSpan={3}>
                등록된 회사가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}



