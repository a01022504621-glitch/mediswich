// lib/types/capacity.ts
export type CapacityDefaults = {
  BASIC: number; // 기본
  NHIS: number;  // 공단
  SPECIAL: number; // 특수
};

export type SpecialItem = { id: string; name: string };

export type Specials = {
  items: SpecialItem[];
  labels?: string[]; // 선택. UI 라벨만 쓰는 경우
};

export type Managed = {
  manageBasic: boolean;
  manageEgd: boolean;
  manageCol: boolean;
  exams: string[]; // 관리 대상 examId 목록
};

export type CapacitySettingShape = {
  defaults: CapacityDefaults;
  examDefaults: Record<string, number>;
  specials: Specials;
  managed: Managed;
};

// 유틸
export const zeroDefaults: CapacityDefaults = { BASIC: 0, NHIS: 0, SPECIAL: 0 };
export const emptySetting: CapacitySettingShape = {
  defaults: zeroDefaults,
  examDefaults: {},
  specials: { items: [], labels: [] },
  managed: { manageBasic: false, manageEgd: false, manageCol: false, exams: [] },
};


