import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

function findBar(label: string): HTMLElement {
  const bars = Array.from(document.querySelectorAll('.bar'));
  const bar = bars.find((b) => b.textContent?.includes(label));
  if (!bar) throw new Error(`Bar "${label}" tidak ditemukan`);
  return bar as HTMLElement;
}

function dragBar(bar: HTMLElement, fromX: number, toX: number) {
  fireEvent.pointerDown(bar, { clientX: fromX, pointerId: 1 });
  fireEvent.pointerMove(bar, { clientX: toX, pointerId: 1 });
  fireEvent.pointerUp(bar, { clientX: toX, pointerId: 1 });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Interaksi Gantt (drag / resize)', () => {
  it('menampilkan bar untuk setiap tugas seed', () => {
    render(<App />);
    expect(document.querySelectorAll('.bar').length).toBe(16);
    // seluruh bar punya handle kiri & kanan
    expect(document.querySelectorAll('.handle.left').length).toBe(16);
    expect(document.querySelectorAll('.handle.right').length).toBe(16);
  });

  it('seret bar ke kanan memajukan tanggal mulai (kelipatan hari kerja)', () => {
    render(<App />);
    const bar = findBar('Setup Environment');
    const before = bar.getAttribute('title') ?? '';
    // Seed: 26 Okt adalah hari libur, jadi tugas digeser ke Sel 27 Okt 2026
    expect(before).toContain('27 Okt 2026');

    // 3 kolom hari ke kanan: Sel 27 → Jumat 30 Okt 2026
    dragBar(bar, 100, 100 + 3 * 34);

    const moved = findBar('Setup Environment');
    expect(moved.getAttribute('title')).not.toBe(before);
    expect(moved.getAttribute('title')).toContain('30 Okt 2026');
  });

  it('seret bar melewati akhir pekan melompat ke hari kerja berikutnya', () => {
    render(<App />);
    // Sel 27 Okt +4 hari = Sabtu 31 Okt (non-kerja) -> naik ke Senin 2 Nov 2026
    const bar = findBar('Setup Environment');
    dragBar(bar, 100, 100 + 4 * 34);
    expect(findBar('Setup Environment').getAttribute('title')).toContain('2 Nov 2026');
  });

  it('tarik tepi kanan bar memperpanjang durasi', () => {
    render(<App />);
    const bar = findBar('Setup Environment');
    const handle = bar.querySelector('.handle.right') as HTMLElement;
    expect(handle).not.toBeNull();
    // durasi awal 1 hari kerja -> +2 hari kerja = 3
    dragBar(handle, 200, 200 + 2 * 34);
    const label = screen.getAllByText('Setup Environment').length;
    expect(label).toBeGreaterThan(0);
    // title bar memuat durasi terbaru
    expect(findBar('Setup Environment').getAttribute('title')).toContain('(3 hari kerja)');
  });

  it('tarik tepi kiri bar memperpendek durasi tanpa menggeser akhir', () => {
    render(<App />);
    const bar = findBar('Frontend Aplikasi'); // durasi 4 hari kerja
    expect(bar.getAttribute('title')).toContain('(4 hari kerja)');
    const handle = bar.querySelector('.handle.left') as HTMLElement;
    // geser tepi kiri +1 hari kerja -> durasi 3, akhir tetap
    dragBar(handle, 300, 300 + 34);
    const after = findBar('Frontend Aplikasi');
    expect(after.getAttribute('title')).toContain('(3 hari kerja)');
  });

  it('tanpa gerakan (delta 0) tidak mengubah data', () => {
    render(<App />);
    const bar = findBar('Setup Environment');
    const before = bar.getAttribute('title');
    dragBar(bar, 100, 100);
    expect(findBar('Setup Environment').getAttribute('title')).toBe(before);
  });

  it('perubahan hasil drag tersimpan ke localStorage', () => {
    render(<App />);
    const bar = findBar('Setup Environment');
    dragBar(bar, 100, 100 + 34);
    const raw = window.localStorage.getItem('freebuff-project-state-v1') ?? '';
    const parsed = JSON.parse(raw);
    const task = parsed.tasks.find((t: { name: string }) => t.name === 'Setup Environment');
    // Sel 27 Okt + 1 hari = Rab 28 Okt 2026
    expect(task.startDate).toBe('2026-10-28');
  });
});
