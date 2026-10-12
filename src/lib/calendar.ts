import type { CalendarConfig } from '../types';

const MS_PER_DAY = 86_400_000;
const ORIGIN = '2000-01-01';
const MAX_SCAN = 500_000;
const MAX_STEP = 5_000;

export const MIN_DATE = ORIGIN;

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseISO(iso: string): Date {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISO(iso);
  return !Number.isNaN(d.getTime()) && toISODate(d) === iso;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

export function dayDiff(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / MS_PER_DAY);
}

export function dayOfWeek(iso: string): number {
  return parseISO(iso).getUTCDay();
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// Kalender kerja
// ---------------------------------------------------------------------------

export function isWeekendDay(iso: string, cal: CalendarConfig): boolean {
  return cal.weekendDays.includes(dayOfWeek(iso));
}

export function getHoliday(iso: string, cal: CalendarConfig): string | null {
  const hit = cal.holidays.find((h) => h.date === iso);
  return hit ? hit.name : null;
}

export function isWorkingDay(iso: string, cal: CalendarConfig): boolean {
  if (!isValidISO(iso)) return false;
  if (cal.weekendDays.includes(dayOfWeek(iso))) return false;
  return !cal.holidays.some((h) => h.date === iso);
}

export function nextWorkingDay(iso: string, cal: CalendarConfig): string {
  let cur = isValidISO(iso) ? iso : ORIGIN;
  for (let i = 0; i < MAX_STEP; i++) {
    if (isWorkingDay(cur, cal)) return cur;
    cur = addDays(cur, 1);
  }
  return cur;
}

export function prevWorkingDay(iso: string, cal: CalendarConfig): string {
  let cur = isValidISO(iso) ? iso : ORIGIN;
  for (let i = 0; i < MAX_STEP; i++) {
    if (isWorkingDay(cur, cal)) return cur;
    cur = addDays(cur, -1);
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Indeks hari kerja (urutan hari kerja sejak ORIGIN) untuk perhitungan CPM
// ---------------------------------------------------------------------------

interface IndexCache {
  key: string;
  /** Daftar tanggal hari kerja dari ORIGIN, terurut naik. */
  days: string[];
  /** Jumlah hari kalender dari ORIGIN yang sudah dipindai. */
  scanned: number;
}

let cache: IndexCache = { key: '', days: [], scanned: 0 };

function configKey(cal: CalendarConfig): string {
  const we = [...cal.weekendDays].sort((a, b) => a - b).join(',');
  const ho = cal.holidays.map((h) => h.date).sort().join(',');
  return `${we}#${ho}`;
}

function ensureCache(cal: CalendarConfig): IndexCache {
  const key = configKey(cal);
  if (cache.key !== key) cache = { key, days: [], scanned: 0 };
  return cache;
}

/** Pindai hari kalender dari ORIGIN sampai (tidak termasuk) untilISO. */
function scan(c: IndexCache, cal: CalendarConfig, untilISO: string): void {
  const target = dayDiff(ORIGIN, untilISO);
  if (target <= c.scanned) return;
  const limit = Math.min(target, c.scanned + MAX_SCAN);
  while (c.scanned < limit) {
    const iso = addDays(ORIGIN, c.scanned);
    if (isWorkingDay(iso, cal)) c.days.push(iso);
    c.scanned += 1;
  }
}

/**
 * Peringkat hari kerja: jumlah hari kerja di [ORIGIN, iso).
 * Untuk tanggal non-kerja hasilnya sama dengan peringkat hari kerja
 * berikutnya (efektif membulatkan ke atas ke hari kerja).
 */
export function toIndex(iso: string, cal: CalendarConfig): number {
  if (!isValidISO(iso)) return 0;
  if (iso <= ORIGIN) return 0;
  const c = ensureCache(cal);
  scan(c, cal, iso);
  let lo = 0;
  let hi = c.days.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c.days[mid] < iso) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Tanggal hari kerja ke-i (0-based) sejak ORIGIN. */
export function fromIndex(index: number, cal: CalendarConfig): string {
  if (index < 0) return ORIGIN;
  const c = ensureCache(cal);
  let guard = 0;
  while (c.days.length <= index && guard < MAX_SCAN) {
    scan(c, cal, addDays(ORIGIN, c.scanned + 1));
    guard += 1;
  }
  return c.days[index] ?? c.days[c.days.length - 1] ?? ORIGIN;
}

/** Maju mundur n hari kerja dari tanggal (tanggal dibulatkan ke hari kerja). */
export function addWorkdays(iso: string, n: number, cal: CalendarConfig): string {
  const base = nextWorkingDay(iso, cal);
  const idx = toIndex(base, cal) + Math.round(n);
  return fromIndex(idx, cal);
}

/** Akhir tugas: durasi hari kerja, hari pertama = hari kerja pertama >= start. */
export function durationEndDate(start: string, duration: number, cal: CalendarConfig): string {
  const dur = Math.max(1, Math.round(duration));
  const first = nextWorkingDay(start, cal);
  return fromIndex(toIndex(first, cal) + dur - 1, cal);
}

/** Jumlah hari kerja inklusif dari a..b (0 bila b < a atau tak ada hari kerja). */
export function countWorkdaysInclusive(a: string, b: string, cal: CalendarConfig): number {
  if (!isValidISO(a) || !isValidISO(b) || a > b) return 0;
  // toIndex(x) = jumlah hari kerja di [ORIGIN, x) -> hari kerja di [a, b]
  return Math.max(0, toIndex(addDays(b, 1), cal) - toIndex(a, cal));
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

export function formatShort(iso: string): string {
  if (!isValidISO(iso)) return '-';
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatCompact(iso: string): string {
  if (!isValidISO(iso)) return '-';
  const d = parseISO(iso);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function dayName(iso: string): string {
  if (!isValidISO(iso)) return '-';
  return DAY_FULL[dayOfWeek(iso)];
}

export function dayLetter(iso: string): string {
  if (!isValidISO(iso)) return '-';
  return DAY_NAMES[dayOfWeek(iso)];
}

export function formatMonthYear(iso: string): string {
  if (!isValidISO(iso)) return '-';
  const d = parseISO(iso);
  const full = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${full[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatIDR(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0';
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}
