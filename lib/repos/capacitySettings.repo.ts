// lib/repos/capacitySettings.repo.ts
import prisma from "@/lib/prisma-scope";
import {
  type CapacitySettingShape,
  type CapacityDefaults,
  type Specials,
  type Managed,
  emptySetting,
  zeroDefaults,
} from "@/lib/types/capacity";

// 정규화
function normDefaults(v: any): CapacityDefaults {
  const n = {
    BASIC: Number(v?.BASIC ?? 0),
    NHIS: Number(v?.NHIS ?? 0),
    SPECIAL: Number(v?.SPECIAL ?? 0),
  };
  n.BASIC = Number.isFinite(n.BASIC) && n.BASIC >= 0 ? n.BASIC : 0;
  n.NHIS = Number.isFinite(n.NHIS) && n.NHIS >= 0 ? n.NHIS : 0;
  n.SPECIAL = Number.isFinite(n.SPECIAL) && n.SPECIAL >= 0 ? n.SPECIAL : 0;
  return n;
}

function normExamDefaults(v: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) {
      const n = Number(val as any);
      if (Number.isFinite(n) && n >= 0) out[String(k)] = n;
    }
  }
  return out;
}

function normSpecials(v: any): Specials {
  const itemsRaw = (v?.items ?? []) as any[];
  const labelsRaw = (v?.labels ?? []) as any[];
  const seen = new Set<string>();
  const items = [];
  for (const it of itemsRaw) {
    const id = typeof it?.id === "string" ? it.id.trim() : "";
    const name = typeof it?.name === "string" ? it.name.trim() : "";
    if (!id || !name) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, name });
    if (items.length >= 200) break;
  }
  const labels = labelsRaw.filter((s: any) => typeof s === "string" && s.trim().length > 0).map((s: string) => s.trim());
  return { items, labels };
}

function normManaged(v: any): Managed {
  const b = (x: any) => (typeof x === "boolean" ? x : false);
  const examsArr = Array.isArray(v?.exams) ? v.exams.map(String) : [];
  const exams = Array.from(new Set(examsArr));
  return {
    manageBasic: b(v?.manageBasic),
    manageEgd: b(v?.manageEgd),
    manageCol: b(v?.manageCol),
    exams,
  };
}

function toShape(row: any): CapacitySettingShape {
  if (!row) return emptySetting;
  return {
    defaults: normDefaults(row.defaults),
    examDefaults: normExamDefaults(row.examDefaults),
    specials: normSpecials(row.specials),
    managed: normManaged(row.managed),
  };
}

// CapacityDefault → 초기값
async function readCapacityDefault(hospitalId: string): Promise<CapacityDefaults> {
  const cd = await prisma.capacityDefault.findUnique({ where: { hospitalId } });
  return {
    BASIC: Number(cd?.basicCap ?? 0) || 0,
    NHIS: Number(cd?.nhisCap ?? 0) || 0,
    SPECIAL: Number(cd?.specialCap ?? 0) || 0,
  };
}

export const capacitySettingsRepo = {
  // 읽기. 없으면 빈 구조 반환(쓰기 없음)
  async get(hospitalId: string): Promise<CapacitySettingShape> {
    const row = await prisma.capacitySetting.findUnique({ where: { hospitalId } });
    if (!row) return { ...emptySetting, defaults: await readCapacityDefault(hospitalId) };
    return toShape(row);
  },

  // 없으면 생성 후 반환. 생성 시 CapacityDefault 값 반영
  async getOrInit(hospitalId: string): Promise<CapacitySettingShape> {
    const defaults = await readCapacityDefault(hospitalId);
    const row = await prisma.capacitySetting.upsert({
      where: { hospitalId },
      update: {},
      create: {
        hospitalId,
        defaults: defaults as any,
        examDefaults: {} as any,
        specials: { items: [], labels: [] } as any,
        managed: { manageBasic: false, manageEgd: false, manageCol: false, exams: [] } as any,
      },
    });
    return toShape(row);
  },

  // 부분 업데이트 머지
  async update(hospitalId: string, patch: Partial<CapacitySettingShape>): Promise<CapacitySettingShape> {
    const current = await this.getOrInit(hospitalId);

    const nextDefaults =
      patch.defaults ? normDefaults({ ...current.defaults, ...patch.defaults }) : current.defaults;

    const nextExamDefaults = patch.examDefaults
      ? { ...current.examDefaults, ...normExamDefaults(patch.examDefaults) }
      : current.examDefaults;

    const nextSpecials = patch.specials
      ? (() => {
          const cur = current.specials;
          const merged = {
            items: patch.specials.items !== undefined ? patch.specials.items : cur.items,
            labels: patch.specials.labels !== undefined ? patch.specials.labels : cur.labels,
          };
          return normSpecials(merged);
        })()
      : current.specials;

    const nextManaged = patch.managed
      ? normManaged({ ...current.managed, ...patch.managed })
      : current.managed;

    const updated = await prisma.capacitySetting.update({
      where: { hospitalId },
      data: {
        defaults: nextDefaults as any,
        examDefaults: nextExamDefaults as any,
        specials: nextSpecials as any,
        managed: nextManaged as any,
      },
    });
    return toShape(updated);
  },

  // 개별 편의 메서드
  async setDefaults(hospitalId: string, v: CapacityDefaults) {
    return this.update(hospitalId, { defaults: v });
  },
  async setExamDefaults(hospitalId: string, v: Record<string, number>) {
    return this.update(hospitalId, { examDefaults: v });
  },
  async setSpecialItems(hospitalId: string, items: { id: string; name: string }[]) {
    return this.update(hospitalId, { specials: { items } });
  },
  async setSpecialLabels(hospitalId: string, labels: string[]) {
    return this.update(hospitalId, { specials: { labels } as any });
  },
  async setManaged(hospitalId: string, v: Managed) {
    return this.update(hospitalId, { managed: v });
  },
};

// 캘린더 기본치 조회용 헬퍼
export async function readDefaultCapOrZero(hospitalId: string): Promise<CapacityDefaults> {
  const row = await prisma.capacitySetting.findUnique({ where: { hospitalId }, select: { defaults: true } });
  return row ? normDefaults(row.defaults) : await readCapacityDefault(hospitalId).catch(() => zeroDefaults);
}


