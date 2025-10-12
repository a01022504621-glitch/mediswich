// app/(m-protected)/m/packages/_hooks.ts
"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, useCallback } from "react";

/** 간단 디바운스 유틸 */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 500) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** 코드맵(codes) 저장을 디바운스로 관리 + 선택적으로 행 반영까지 */
export function useDebouncedCodes(
  initial: Record<string, string>,
  saveFn: (next: Record<string, string>) => void,
  delay = 500
) {
  const [codes, setCodes] = useState<Record<string, string>>(initial);
  const saveDebounced = useMemo(() => debounce(saveFn, delay), [saveFn, delay]);
  const [isPending, startTransition] = useTransition();

  const setCode = useCallback(
    (examId: string, code: string, applyRows?: (examId: string, code: string) => void) => {
      setCodes((prev) => {
        const next = { ...prev, [examId]: code };
        saveDebounced(next);
        return next;
      });
      if (applyRows) {
        startTransition(() => applyRows(examId, code));
      }
    },
    [saveDebounced]
  );

  return { codes, setCode, isPending };
}

/** 현재 드래프트의 examId → 그룹ID 단일 소유 맵 */
export function useOwnerMap(draft: { groupOrder: string[]; groups: Record<string, { examId: string }[]> }) {
  const ref = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const m = new Map<string, string>();
    for (const gid of draft.groupOrder) {
      for (const r of draft.groups[gid] || []) m.set(r.examId, gid);
    }
    ref.current = m;
  }, [draft.groupOrder, draft.groups]);
  return ref;
}

/** 지연 쿼리 기반 필터링 훅 */
export function useDeferredFilter<T>(items: T[], query: string, pred: (x: T, q: string) => boolean) {
  const dq = useDeferredValue(query);
  return useMemo(() => {
    const s = dq.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => pred(x, s));
  }, [items, dq, pred]);
}

