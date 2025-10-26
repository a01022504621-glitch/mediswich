// app/(m-protected)/m/logout/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";

export default async function Page() {
  redirect("/api/auth/logout?next=/m/login");
}
