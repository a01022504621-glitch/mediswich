export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// app/api/clients/template/route.ts
import "server-only";
import { NextResponse } from "next/server";

export async function GET() {
  const csv = "이름,전화번호,지원여부,지원금\n홍길동,010-1234-5678,Y,10000\n";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients_template.csv"`,
    },
  });
}
