// app/(m-protected)/m/logout/page.tsx
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  // 서버에서 호출 → /api/auth/logout 이 도메인/패스 조합으로 모두 만료
  await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
  redirect("/m/login");
}
