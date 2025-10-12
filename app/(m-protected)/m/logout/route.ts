import { NextResponse } from "next/server";
const isProd = process.env.NODE_ENV === "production";

export async function POST() {
  const res = NextResponse.redirect(new URL("/m/login", "http://localhost:3000"));
  res.cookies.set(process.env.COOKIE_NAME || "msw_m", "", {
    path: "/",                   // ★ 여기서도 "/"로
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires: new Date(0),
  });
  return res;
}
