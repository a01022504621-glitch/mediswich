// app/(m-protected)/m/bookings/page.tsx
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";
import type { CSSProperties } from "react";

type BookingRow = Awaited<ReturnType<typeof prisma.booking.findMany>>[number];

export default async function BookingsPage() {
  const s = await requireSession();
  const hid = s.hid!;
  const items: BookingRow[] = await prisma.booking.findMany({
    where: { hospitalId: hid },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>예약</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>이름</th>
            <th style={th}>날짜/시간</th>
            <th style={th}>상품ID</th>
            <th style={th}>상태</th>
            <th style={th}>연락처</th>
            <th style={th}>생성일</th>
          </tr>
        </thead>
        <tbody>
          {items.map((b: BookingRow) => (
            <tr key={b.id}>
              <td style={td}>{b.name}</td>
              <td style={td}>
                {new Date(b.date).toLocaleDateString()} {b.time}
              </td>
              <td style={td}>{b.packageId}</td>
              <td style={td}>{b.status}</td>
              <td style={td}>{b.phone}</td>
              <td style={td}>{new Date(b.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} style={td}>
                예약이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const th: CSSProperties = { textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" };
const td: CSSProperties = { padding: 8, borderBottom: "1px solid #e5e7eb" };


