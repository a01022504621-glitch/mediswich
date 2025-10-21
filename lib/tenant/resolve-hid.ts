// lib/tenant/resolve-hid.ts
import { cookies, headers } from "next/headers";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";

/**
 * 병원 ID 해석 우선순위:
 * 1) current_hospital_slug 또는 r_tenant → DB 조회 → ID 쿠키 교정
 * 2) current_hospital_id 쿠키
 * 3) 세션의 hid/hospitalId
 * 4) Host 헤더로 테넌트 해석
 */
export async function resolveHidStrict(session?: any): Promise<string> {
  const ck = cookies();
  const hd = headers();
  const host = hd.get("host") || undefined;

  const slug =
    ck.get("current_hospital_slug")?.value ||
    ck.get("r_tenant")?.value ||
    "";

  const idCookie = ck.get("current_hospital_id")?.value || "";

  // 1) 슬러그 우선 해석
  if (slug) {
    const t = await resolveTenantHybrid({ slug, host });
    if (t?.id) {
      // 쿠키 불일치 시 교정
      if (idCookie !== t.id) {
        ck.set("current_hospital_id", t.id, {
          path: "/",
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        });
      }
      return t.id;
    }
  }

  // 2) ID 쿠키
  if (idCookie) return idCookie;

  // 3) 세션
  const hid = session?.hid || session?.hospitalId;
  if (hid) return String(hid);

  // 4) Host 기반 해석
  const t2 = await resolveTenantHybrid({ host });
  if (t2?.id) {
    ck.set("current_hospital_id", t2.id, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    ck.set("current_hospital_slug", t2.slug, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return t2.id;
  }

  return "";
}



