// lib/pkgs/normalize.ts
// 패키지 드래프트/저장본을 표준 구조로 정규화:
// - 기본그룹 id를 'basic'으로 확정
// - 선택그룹은 'opt_xxx' 형태로 정리하며 chooseCount 기본 1 보장
// - examId 중복은 "기본 → groupOrder" 우선순위로 단일 소유 보장
// - 기본그룹 내 정렬(문진/상담 → 기초 → 혈액 → 소변 → 영상/초음파 → 기타)

export type Sex = "A" | "M" | "F";
export type GroupRow = { examId: string; sex: Sex; memo?: string; code?: string };
export type GroupMeta = { id: string; label: string; color?: string; chooseCount?: number | null };
export type DraftPackage = {
  id: string;
  name: string;
  price: number;
  groups: Record<string, GroupRow[]>;
  groupOrder: string[];
  meta: Record<string, GroupMeta>;
  // 기타 필드는 그대로 둠
};

const BASIC_KEYS = ["basic", "base", "general", "기본", "일반", "일반검사", "기본검사"];

function looksLikeBasic(meta?: GroupMeta) {
  if (!meta) return false;
  const id = (meta.id || "").toLowerCase();
  const label = (meta.label || "").toLowerCase();
  return BASIC_KEYS.some(k => id === k || label.includes(k));
}

function ensureOptId(rawId: string, idx: number) {
  // 이미 opt_ 로 시작하면 유지, 아니면 opt_ 접두
  return rawId.startsWith("opt_") ? rawId : `opt_${rawId || `group${idx + 1}`}`;
}

const BASIC_ORDER_BUCKETS: { name: string; keys: RegExp[] }[] = [
  { name: "문진/상담", keys: [/문진/, /상담/, /결과상담/] },
  { name: "기초", keys: [/기초/, /신체검사/, /체성분|비만|BMI/] },
  { name: "혈액", keys: [/혈액|CBC|Hb|AST|ALT|간|지질|콜레스테롤|당화|Glucose|Lipid/i] },
  { name: "소변", keys: [/소변|요검사|UA/i] },
  { name: "영상/초음파", keys: [/X-?ray|촬영|초음파|US|CT|MRI|Echo|ECG|심전도/i] },
];

function basicBucketIndex(examName: string) {
  for (let i = 0; i < BASIC_ORDER_BUCKETS.length; i++) {
    if (BASIC_ORDER_BUCKETS[i].keys.some(rx => rx.test(examName))) return i;
  }
  return BASIC_ORDER_BUCKETS.length; // 기타
}

export function normalizeDraft(input: DraftPackage & { examNameById?: (id: string) => string }): DraftPackage {
  const { groups, groupOrder, meta } = input;

  // 1) 기본그룹 결정
  let basicId: string | null = null;
  // (1) meta 기준
  for (const gid of groupOrder) {
    if (looksLikeBasic(meta[gid])) { basicId = gid; break; }
  }
  // (2) id 힌트
  if (!basicId) {
    for (const gid of groupOrder) {
      const idL = (gid || "").toLowerCase();
      if (BASIC_KEYS.includes(idL)) { basicId = gid; break; }
    }
  }
  // (3) 최종 fallback: 첫 그룹
  if (!basicId && groupOrder.length) basicId = groupOrder[0];

  // 2) 중복 소유 정리(기본 우선)
  const owner = new Map<string, string>();
  const outGroups: Record<string, GroupRow[]> = {};
  const outMeta: Record<string, GroupMeta> = {};

  // owner 초기화
  if (basicId && groups[basicId]) {
    outGroups[basicId] = [];
    for (const r of groups[basicId]) {
      if (!owner.has(r.examId)) { owner.set(r.examId, basicId); outGroups[basicId].push({ ...r }); }
    }
    outMeta[basicId] = { ...meta[basicId], id: "basic", label: meta[basicId]?.label || "기본검사" };
  }

  // 3) 선택그룹 변환
  let optIndex = 0;
  for (const gid of groupOrder) {
    if (gid === basicId) continue;
    const rows = groups[gid] || [];
    const m = meta[gid] || { id: gid, label: gid };
    const normalizedId = ensureOptId(m.id || gid, optIndex++);
    const chooseCount = m.chooseCount == null ? 1 : Math.max(1, Number(m.chooseCount) || 1);

    const accepted: GroupRow[] = [];
    for (const r of rows) {
      if (owner.has(r.examId)) continue; // 중복 제거
      owner.set(r.examId, normalizedId);
      accepted.push({ ...r });
    }

    if (accepted.length > 0) {
      outGroups[normalizedId] = accepted;
      outMeta[normalizedId] = { ...m, id: normalizedId, chooseCount, label: m.label || normalizedId };
    }
  }

  // 4) 기본그룹 정렬
  if (basicId && outGroups["basic"]) {
    const getName = input.examNameById || (() => "");
    outGroups["basic"].sort((a, b) => {
      const na = getName(a.examId) || "";
      const nb = getName(b.examId) || "";
      const ba = basicBucketIndex(na);
      const bb = basicBucketIndex(nb);
      if (ba !== bb) return ba - bb;
      return na.localeCompare(nb, "ko");
    });
  }

  // 5) 출력용 groupOrder 재생성: 기본 → 선택
  const outOrder = ["basic", ...Object.keys(outGroups).filter(id => id !== "basic")];

  return {
    ...input,
    groups: outGroups,
    groupOrder: outOrder,
    meta: outMeta,
  };
}

