// lib/packageTags.ts
export type Sex = "A" | "M" | "F";
export type PackageRow = { examId: string; name?: string; sex?: Sex; memo?: string; code?: string };
export type OptionGroup = { id: string; chooseCount: number; items: PackageRow[] };
export type Addon = { name: string; sex: Sex; price: number | null };
export type PackageTags = {
  groups?: Record<string, { items?: PackageRow[]; chooseCount?: number }>;
  addons?: Addon[];
  builder?: any;
};

function groupsOf(tags: any) {
  const g = (tags as PackageTags)?.groups ?? {};
  return g && typeof g === "object" ? g : {};
}

/** 기본검사 항목 (basic → base → general 순서로 호환) */
export function getBasicItems(tags: any): PackageRow[] {
  const g = groupsOf(tags);
  return g.basic?.items ?? g.base?.items ?? g.general?.items ?? [];
}

/** 선택검사 그룹들(기본/암/레거시 제외) */
export function getOptionGroups(tags: any): OptionGroup[] {
  const g = groupsOf(tags);
  return Object.entries(g)
    .filter(([k]) => !["basic", "base", "general", "cancer"].includes(k))
    .map(([id, v]: any) => ({
      id,
      chooseCount: typeof v?.chooseCount === "number" ? v.chooseCount : 1,
      items: Array.isArray(v?.items) ? v.items : [],
    }));
}

/** 추가검사 */
export function getAddons(tags: any): Addon[] {
  const a = (tags as PackageTags)?.addons;
  if (!Array.isArray(a)) return [];
  return a.map((x) => ({
    name: String(x?.name ?? ""),
    sex: x?.sex === "M" || x?.sex === "F" ? x.sex : "A",
    price: typeof x?.price === "number" ? x.price : null,
  }));
}

