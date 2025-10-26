import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  cookies().delete(COOKIE_NAME); // path=/ 로 세팅된 쿠키 삭제
  redirect("/m/login");
}
