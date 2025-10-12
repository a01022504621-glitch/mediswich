// lib/vaccineAdminStore.ts
// 관리자 전용 데모 저장소 (localStorage + 메모리)
// 추후 Prisma 연동 시, 아래 read/write 부분을 /api 라우트로 교체하세요.

export type VaccineKind = "GENERAL" | "FLU";
export type VaccineId = string;

export interface VaccineItem {
  id: VaccineId;
  kind: VaccineKind;      // GENERAL | FLU
  drugName: string;       // 약품명
  manufacturer?: string;  // 제약사
  price: number;          // 비용(원)
  doseCount?: number;     // (선택) 회차
  active: boolean;        // 진행/중지
  periodStart?: string;   // YYYY-MM-DD
  periodEnd?: string;     // YYYY-MM-DD
  notes?: string;         // 비고/안내
  createdAt: string;
  updatedAt: string;
}

const KEY = "__demo_vaccine_admin_items__";

let memory: VaccineItem[] = [];

function read(): VaccineItem[] {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory;
    memory = JSON.parse(raw) as VaccineItem[];
  } catch {
    // ignore
  }
  return memory;
}

function write(next: VaccineItem[]) {
  memory = next;
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function listVaccines(kind?: VaccineKind): VaccineItem[] {
  const all = read();
  const arr = kind ? all.filter(v => v.kind === kind) : all;
  // 진행중 우선 정렬
  return [...arr].sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));
}

export function getVaccine(id: VaccineId): VaccineItem | undefined {
  return read().find(v => v.id === id);
}

export function saveVaccine(input: Partial<VaccineItem> & {
  kind: VaccineKind;
  drugName: string;
  price: number;
}): VaccineItem {
  const now = new Date().toISOString();
  const all = read();

  // update
  if (input.id) {
    const idx = all.findIndex(v => v.id === input.id);
    if (idx >= 0) {
      const prev = all[idx];
      const next: VaccineItem = {
        ...prev,
        ...input,
        id: prev.id,
        kind: input.kind ?? prev.kind,
        drugName: input.drugName ?? prev.drugName,
        price: Number(input.price ?? prev.price) || 0,
        updatedAt: now,
      };
      all[idx] = next;
      write(all);
      return next;
    }
  }

  // create
  const item: VaccineItem = {
    id: uid(),
    kind: input.kind,
    drugName: input.drugName,
    manufacturer: input.manufacturer ?? "",
    price: Number(input.price) || 0,
    doseCount: input.doseCount ?? 1,
    active: input.active ?? true,
    periodStart: input.periodStart ?? "",
    periodEnd: input.periodEnd ?? "",
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  write([item, ...all]);
  return item;
}

export function removeVaccine(id: VaccineId) {
  const all = read().filter(v => v.id !== id);
  write(all);
}

export function clearDemoVaccines() {
  write([]);
}

// ===== 추천 목록(버튼 한 번으로 빠르게 채우는 용) =====
export const SUGGEST_GENERAL: Array<[drug: string, maker?: string]> = [
  ["대상포진(시냅스/싱그릭스 등)", "GSK/MSD"],
  ["폐렴구균(프리베나/뉴모박스)", "Pfizer/MSD"],
  ["A형간염", "SK/GC/MSD"],
  ["B형간염", "SK/GC/MSD"],
  ["홍역·볼거리·풍진(MMR)", "MSD"],
  ["Tdap/DTaP(파상풍/디프테리아/백일해)", "GSK/Sanofi"],
  ["자궁경부암(가다실/서바릭스)", "MSD/GSK"],
  ["수두", "GC/SK"],
  ["일본뇌염", "GC/녹십자"],
];

export const SUGGEST_FLU: Array<[drug: string, maker?: string]> = [
  ["독감 4가(성인용)"],
  ["독감 4가(소아용)"],
  ["독감 고연령자(고용량/보강형)", "사노피/에스에프"],
];

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  return "id-" + Math.random().toString(36).slice(2);
}
