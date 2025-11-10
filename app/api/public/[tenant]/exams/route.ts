// app/api/public/[tenant]/exams/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveTenantHybrid } from "@/lib/tenant/resolve";
import * as examStore from "@/lib/examStore";

type Sex = "M" | "F" | null;
type Item = { name: string; code?: string | null; sex?: Sex };

function normName(s?: string) {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
function nonEmptyCode(v: any) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function normSex(x: any): Sex {
  const s = String(x ?? "").trim().toUpperCase();
  if (["M", "MALE", "남", "남성"].includes(s)) return "M";
  if (["F", "FEMALE", "여", "여성"].includes(s)) return "F";
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tenant: string } }
) {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const t = await resolveTenantHybrid({ slug: params.tenant, host });
    if (!t) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
    const hid = t.id;

    // 1) 병원 공통 코드 저장소
    let rows: any[] = [];
    try {
      if (typeof (examStore as any).loadCodes === "function") {
        rows = (await (examStore as any).loadCodes(hid)) ?? [];
        if (!Array.isArray(rows) || rows.length === 0) {
          rows = (await (examStore as any).loadCodes({ hid })) ?? [];
        }
      }
    } catch {
      rows = [];
    }

    const byName = new Map<string, Item>();
    const push = (name?: string, code?: any, sex?: any) => {
      const nm = normName(name);
      if (!nm) return;
      const cd = nonEmptyCode(code);
      const sx = normSex(sex);
      const prev = byName.get(nm);
      if (!prev) {
        byName.set(nm, { name: String(name ?? "").trim(), code: cd, sex: sx });
      } else {
        // 코드가 비어있을 때만 보강
        if (!prev.code && cd) byName.set(nm, { ...prev, code: cd });
        // 성별 보강
        if (!prev.sex && sx) byName.set(nm, { ...byName.get(nm)!, sex: sx });
      }
    };

    for (const r of rows || []) {
      push(r?.name ?? r?.exam ?? r?.title, r?.code ?? r?.examCode, r?.sex ?? r?.gender);
    }

    // 2) 패키지 포함 항목에서 코드 보강
    try {
      if (typeof (examStore as any).loadPackagesDBFirst === "function") {
        const pkgs = (await (examStore as any).loadPackagesDBFirst(hid)) ?? [];
        for (const p of pkgs) {
          const groups = (p?.optionGroups || p?.groups || []);
          for (const g of groups) {
            for (const it of g?.items || []) {
              push(it?.name, it?.code, it?.sex ?? it?.gender ?? it?.sexNormalized);
            }
          }
          for (const bi of p?.basicItems || []) {
            push(bi?.name, bi?.code, bi?.sex ?? bi?.gender ?? bi?.sexNormalized);
          }
          for (const bn of p?.basicExams || p?.baseExams || []) {
            push(bn, null);
          }
        }
      }
    } catch {
      /* ignore */
    }

    const items = Array.from(byName.values()).filter((x) => x.name);
    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

