// app/(m-protected)/m/settings/page.tsx
import prisma from "@/lib/prisma-scope";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { CSSProperties } from "react";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function SettingsPage() {
  const s = await requireSession();
  if (!s.hid) return <p>MASTER 계정입니다. 병원 선택 UI는 추후 추가하세요.</p>;
  const hospital = await prisma.hospital.findUnique({ where: { id: s.hid } });

  async function updateHospital(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "");
    const logoUrl = String(formData.get("logoUrl") || "");
    const themePrimary = String(formData.get("themePrimary") || "");
    const noticeText = String(formData.get("noticeText") || "");
    await prisma.hospital.update({
      where: { id: s.hid! },
      data: {
        name,
        logoUrl: logoUrl || null,
        themeJson: JSON.stringify({ primary: themePrimary || "#4F46E5" }),
        noticeHtml: escapeHtml(noticeText),
      },
    });
    await prisma.auditLog.create({
      data: { hospitalId: s.hid!, userId: s.sub, action: "UPDATE_HOSPITAL" },
    });
    revalidatePath("/m/settings");
  }

  const theme = JSON.parse(hospital?.themeJson ?? "{}");
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>병원 설정</h1>
      <form action={updateHospital} style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <label>병원명<input name="name" defaultValue={hospital?.name || ""} style={inp} /></label>
        <label>로고 URL<input name="logoUrl" defaultValue={hospital?.logoUrl || ""} style={inp} /></label>
        <label>테마 Primary(#hex)<input name="themePrimary" defaultValue={theme.primary ?? "#4F46E5"} style={inp} /></label>
        <label>공지(텍스트)<textarea name="noticeText" defaultValue={hospital?.noticeHtml ? hospital?.noticeHtml : ""} style={{ ...inp, height: 160 }} /></label>
        <button style={btn}>저장</button>
      </form>
    </div>
  );
}

const inp: CSSProperties = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, display: "block" };
const btn: CSSProperties = { borderRadius: 8, padding: "8px 12px", background: "#111827", color: "#fff", width: 120 };


