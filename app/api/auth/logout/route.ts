export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/jwt"; // 'msw_m' 상수

// 'msw_m' 외 클라이언트용 만료 쿠키 이름
const EXPIRATION_COOKIE_NAME = "msw_exp";

/**
 * [GET 핸들러] /api/auth/logout 링크 클릭 시
 */
export async function GET(req: NextRequest) {
  // 1. 리다이렉트 URL 가져오기
  const returnTo = req.nextUrl.searchParams.get("next") ?? "/m/login";
  
  // 2. 리다이렉트 응답 객체 생성
  const res = NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));

  // 3. 정확한 쿠키 삭제를 위한 설정값 정의
  const isProd = process.env.NODE_ENV === "production";
  
  // Vercel 배포 시, 쿠키가 생성된 '정확한' 도메인 지정
  const domain = isProd ? "admin.mediswich.co.kr" : undefined;
  
  // 쿠키가 생성된 '정확한' 경로 지정
  const path = "/";

  // 4. 응답 객체에 '정확한' 쿠키 삭제 헤더 추가 (최소한의 헤더만 사용)
  
  // [타겟 1: msw_m (HttpOnly 세션 쿠키)]
  res.cookies.set(COOKIE_NAME, "", {
    path,
    domain,
    maxAge: 0, // 즉시 만료
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
  });

  // [타겟 2: msw_exp (클라이언트용 만료 쿠키)]
  res.cookies.set(EXPIRATION_COOKIE_NAME, "", {
    path,
    domain,
    maxAge: 0,
    httpOnly: false, // HttpOnly가 아님
  });
  
  // [타겟 3 & 4: 병원 선택 쿠키 (HttpOnly로 추정)]
  res.cookies.set("current_hospital_id", "", { path, domain, maxAge: 0, httpOnly: true });
  res.cookies.set("current_hospital_slug", "", { path, domain, maxAge: 0, httpOnly: true });

  // 5. 헤더가 추가된 리다이렉트 응답 반환
  return res;
}

/**
 * [POST 핸들러] (페이지 이동 없이 fetch로 로그아웃 시)
 */
export async function POST(req: NextRequest) {
  // 1. 성공 응답(200 OK) 객체 생성
  const res = NextResponse.json({ ok: true });

  // (GET과 동일한 로직으로 쿠키 삭제 헤더를 '정확하게' 추가)
  const isProd = process.env.NODE_ENV === "production";
  const domain = isProd ? "admin.mediswich.co.kr" : undefined;
  const path = "/";

  // [타겟 1]
  res.cookies.set(COOKIE_NAME, "", {
    path, domain, maxAge: 0, httpOnly: true, secure: isProd, sameSite: "lax",
  });
  
  // [타겟 2]
  res.cookies.set(EXPIRATION_COOKIE_NAME, "", {
    path, domain, maxAge: 0, httpOnly: false,
  });

  // [타겟 3 & 4]
  res.cookies.set("current_hospital_id", "", { path, domain, maxAge: 0, httpOnly: true });
  res.cookies.set("current_hospital_slug", "", { path, domain, maxAge: 0, httpOnly: true });

  // 2. 쿠키 헤더가 추가된 200 OK 응답 반환
  return res;
}

