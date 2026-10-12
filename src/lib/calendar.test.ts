import { describe, expect, it } from 'vitest';
import type { CalendarConfig } from '../types';
import {
  addWorkdays,
  countWorkdaysInclusive,
  dayOfWeek,
  durationEndDate,
  fromIndex,
  isWorkingDay,
  nextWorkingDay,
  toIndex,
} from './calendar';

const cal: CalendarConfig = {
  weekendDays: [0, 6],
  holidays: [{ id: 'h1', date: '2026-10-26', name: 'Libur' }],
};

describe('calendar (hari kerja)', () => {
  it('mengenali akhir pekan dan hari libur', () => {
    expect(dayOfWeek('2026-10-12')).toBe(1); // Senin
    expect(isWorkingDay('2026-10-12', cal)).toBe(true);
    expect(isWorkingDay('2026-10-17', cal)).toBe(false); // Sabtu
    expect(isWorkingDay('2026-10-18', cal)).toBe(false); // Minggu
    expect(isWorkingDay('2026-10-26', cal)).toBe(false); // hari libur custom (Senin)
    expect(isWorkingDay('2026-10-27', cal)).toBe(true);
  });

  it('nextWorkingDay melompati akhir pekan dan hari libur', () => {
    expect(nextWorkingDay('2026-10-17', cal)).toBe('2026-10-19');
    expect(nextWorkingDay('2026-10-25', cal)).toBe('2026-10-27'); // lewat libur 26 Okt
    expect(nextWorkingDay('2026-10-12', cal)).toBe('2026-10-12'); // sudah hari kerja
  });

  it('addWorkdays menghitung mundur hari kerja saja', () => {
    // Senin 12 Okt + 5 hari kerja = Senin 19 Okt
    expect(addWorkdays('2026-10-12', 5, cal)).toBe('2026-10-19');
    expect(addWorkdays('2026-10-12', 0, cal)).toBe('2026-10-12');
    // Jumat 16 Okt + 1 hari kerja = Senin 19 Okt (Sab/Ming dilewati)
    expect(addWorkdays('2026-10-16', 1, cal)).toBe('2026-10-19');
    // dari Senin 26 Okt (libur) dibulatkan ke Selasa 27
    expect(addWorkdays('2026-10-26', 1, cal)).toBe('2026-10-28');
    // mundur
    expect(addWorkdays('2026-10-19', -1, cal)).toBe('2026-10-16');
  });

  it('durationEndDate menghasilkan akhir tugas dalam hari kerja', () => {
    // mulai Senin 12 Okt, durasi 5 hari kerja -> Jumat 16 Okt
    expect(durationEndDate('2026-10-12', 5, cal)).toBe('2026-10-16');
    // durasi 6 hari kerja melewati akhir pekan -> Senin 19 Okt
    expect(durationEndDate('2026-10-12', 6, cal)).toBe('2026-10-19');
    // durasi 1 hari dari tanggal libur -> Selasa 27 Okt (26 libur, naik ke hari kerja)
    expect(durationEndDate('2026-10-26', 1, cal)).toBe('2026-10-27');
  });

  it('countWorkdaysInclusive hanya menghitung hari kerja', () => {
    // 12 Okt s/d 16 Okt = 5 hari kerja
    expect(countWorkdaysInclusive('2026-10-12', '2026-10-16', cal)).toBe(5);
    // 12 Okt s/d 19 Okt = 6 hari kerja (Sab/Ming tidak dihitung)
    expect(countWorkdaysInclusive('2026-10-12', '2026-10-19', cal)).toBe(6);
    // rentang hanya akhir pekan = 0
    expect(countWorkdaysInclusive('2026-10-17', '2026-10-18', cal)).toBe(0);
  });

  it('indeks hari kerja konsisten bolak-balik', () => {
    const idx = toIndex('2026-10-12', cal);
    expect(fromIndex(idx, cal)).toBe('2026-10-12');
    // tanggal akhir pekan memetakan ke hari kerja berikutnya
    expect(toIndex('2026-10-17', cal)).toBe(toIndex('2026-10-19', cal));
  });
});
