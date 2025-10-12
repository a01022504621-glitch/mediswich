export type Participant = {
  name: string;
  phone: string;
  supportYn?: 'Y' | 'N';
  supportAmt?: number;
};

export type ClientRow = {
  id: string;
  name: string;
  contact: string;
  startDate: string;
  endDate: string;
  memo?: string;
  corpCode?: string;
  directUrl?: string;
  participants?: number; // count
  createdAt?: string;
};

type ClientDetail = ClientRow & { participantsList: Participant[] };

const LIST_KEY = '__clients__';
const DETAIL_PREFIX = '__client_';

function readList(): ClientRow[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(LIST_KEY);
  return raw ? JSON.parse(raw) : [];
}
function writeList(list: ClientRow[]) {
  if (typeof window !== 'undefined') localStorage.setItem(LIST_KEY, JSON.stringify(list));
}
function writeDetail(id: string, detail: ClientDetail) {
  if (typeof window !== 'undefined')
    localStorage.setItem(`${DETAIL_PREFIX}${id}__`, JSON.stringify(detail));
}
export function getDetailFallback(id: string): ClientDetail | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`${DETAIL_PREFIX}${id}__`);
  return raw ? JSON.parse(raw) : null;
}

export function listClientsFallback(): ClientRow[] {
  return readList();
}

export function saveClientFallback(p: {
  name: string;
  contact: string;
  startDate: string;
  endDate: string;
  memo?: string;
  corpCode?: string;
  directUrl?: string;
  participants: Participant[];
}): ClientRow {
  const list = readList();
  const id =
    (globalThis.crypto as any)?.randomUUID?.() ??
    `${Date.now()}${Math.random().toString(16).slice(2)}`;

  const row: ClientRow = {
    id,
    name: p.name,
    contact: p.contact,
    startDate: p.startDate,
    endDate: p.endDate,
    memo: p.memo,
    corpCode: p.corpCode,
    directUrl: p.directUrl,
    participants: p.participants?.length ?? 0,
    createdAt: new Date().toISOString(),
  };
  list.unshift(row);
  writeList(list);

  const detail: ClientDetail = { ...row, participantsList: p.participants ?? [] };
  writeDetail(id, detail);

  return row;
}

export function getClientDirectUrl(corpCode?: string) {
  if (!corpCode) return '';
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}/r`;
  const qs = new URLSearchParams({ corp: corpCode });
  return `${base}?${qs.toString()}`;
}

export function formatPhone(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export async function tryFetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

