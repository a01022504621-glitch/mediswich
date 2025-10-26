// app/(m-protected)/m/logout/page.tsx
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  redirect("/api/auth/logout?next=/m/login");
}
