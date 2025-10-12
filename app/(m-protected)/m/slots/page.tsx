import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import type { CSSProperties } from "react";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export default async function SlotsPage() {
  const s = await requireSession();
  const hid = s.hid!;

  const [templates, exceptions] = await Promise.all([
    prisma.slotTemplate.findMany({ where: { hospitalId: hid }, orderBy: [{ dow: "asc" }, { start: "asc" }] }),
    prisma.slotException.findMany({ where: { hospitalId: hid }, orderBy: { date: "asc" } }),
  ]);

  async function createTemplate(formData: FormData) {
    "use server";
    const dow = Number(formData.get("dow") || 0);
    const start = String(formData.get("start") || "");
    const end = String(formData.get("end") || "");
    const capacity = Number(formData.get("capacity") || 0);
    await prisma.slotTemplate.create({ data: { dow, start, end, capacity, hospitalId: hid } });
    revalidatePath("/m/slots");
  }

  async function deleteTemplate(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    await prisma.slotTemplate.deleteMany({ where: { id, hospitalId: hid } });
    revalidatePath("/m/slots");
  }

  async function addException(formData: FormData) {
    "use server";
    const date = new Date(String(formData.get("date")));
    const reason = String(formData.get("reason") || "");
    await prisma.slotException.create({ data: { date, reason, hospitalId: hid } });
    revalidatePath("/m/slots");
  }

  async function deleteException(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    await prisma.slotException.deleteMany({ where: { id, hospitalId: hid } });
    revalidatePath("/m/slots");
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>슬롯</h1>

      <section>
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>요일별 템플릿</h2>
        <form action={createTemplate} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <select name="dow" style={{ ...inp, width: 80 }}>
            {DOW.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input name="start" placeholder="09:00" style={{ ...inp, width: 100 }} />
          <input name="end" placeholder="12:00" style={{ ...inp, width: 100 }} />
          <input name="capacity" type="number" placeholder="인원" style={{ ...inp, width: 100 }} />
          <button style={btn}>추가</button>
        </form>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>요일</th>
              <th style={th}>시간</th>
              <th style={th}>인원</th>
              <th style={th}>액션</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td style={td}>{DOW[t.dow]}</td>
                <td style={td}>
                  {t.start}~{t.end}
                </td>
                <td style={{ ...td, textAlign: "center" }}>{t.capacity}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <form action={deleteTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button style={{ color: "#dc2626" }}>삭제</button>
                  </form>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={4} style={td}>
                  등록된 템플릿이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>예외일(휴무/점검)</h2>
        <form action={addException} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <input type="date" name="date" style={inp} />
          <input name="reason" placeholder="사유" style={inp} />
          <button style={btn}>추가</button>
        </form>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>날짜</th>
              <th style={th}>사유</th>
              <th style={th}>액션</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((e) => (
              <tr key={e.id}>
                <td style={td}>{new Date(e.date).toLocaleDateString()}</td>
                <td style={td}>{e.reason}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <form action={deleteException}>
                    <input type="hidden" name="id" value={e.id} />
                    <button style={{ color: "#dc2626" }}>삭제</button>
                  </form>
                </td>
              </tr>
            ))}
            {exceptions.length === 0 && (
              <tr>
                <td colSpan={3} style={td}>
                  등록된 예외일이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const inp: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 };
const btn: CSSProperties = { borderRadius: 8, padding: "8px 12px", background: "#111827", color: "#fff" };
const table: CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0, border: "1px solid #e5e7eb", borderRadius: 12 };
const th: CSSProperties = { textAlign: "left", padding: 8, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" };
const td: CSSProperties = { padding: 8, borderBottom: "1px solid #e5e7eb" };

