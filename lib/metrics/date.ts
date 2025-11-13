// lib/metrics/date.ts
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function formatYMD(d: Date): `${number}-${number}-${number}` {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}` as any;
}
export function parseYMD(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
}
export function rangeDays(from: Date, toInclusive: Date): Date[] {
  const out: Date[] = [];
  for (let d = new Date(from); d <= toInclusive; d = addDays(d, 1)) out.push(new Date(d));
  return out;
}
export function weekStartMonday(d: Date): Date {
  const wd = d.getDay(); // 0..6, Sun..Sat
  const diff = wd === 0 ? -6 : 1 - wd;
  return startOfDay(addDays(d, diff));
}
export function groupKeyDay(d: Date): string {
  return formatYMD(d);
}
export function groupKeyWeek(d: Date): string {
  const w0 = weekStartMonday(d);
  return formatYMD(w0);
}

