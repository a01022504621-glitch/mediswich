// lib/pkgs/counters.ts
// 정규화된 패키지에서 카드에 표시할 개수 계산

export function computeCounts(pkg: {
  groups: Record<string, { examId: string }[]>;
  meta?: Record<string, { chooseCount?: number | null }>;
}) {
  const basic = pkg.groups["basic"] || [];
  const optIds = Object.keys(pkg.groups).filter(id => id !== "basic");
  const optionGroups = optIds.length;
  const optionTotal = optIds.reduce((acc, id) => acc + (pkg.groups[id]?.length || 0), 0);
  const chooseSum = optIds.reduce((acc, id) => acc + (pkg.meta?.[id]?.chooseCount || 0), 0);

  return {
    basicCount: basic.length,
    optionGroupCount: optionGroups,
    optionTotalCount: optionTotal,
    optionChooseSum: chooseSum, // (표시 여부는 선택)
  };
}

