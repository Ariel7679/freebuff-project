import { describe, expect, it } from 'vitest';
import type { CalendarConfig, Task } from '../types';
import { computeSchedule, topoSort } from './schedule';

const cal: CalendarConfig = { weekendDays: [0, 6], holidays: [] };

function makeTask(partial: Partial<Task> & { id: string; name: string; startDate: string; duration: number }): Task {
  return {
    description: '',
    priority: 'Medium',
    color: '#10b981',
    parentId: null,
    collapsed: false,
    dependencies: [],
    assigneeIds: [],
    progress: 0,
    pert: { optimistic: partial.duration, mostLikely: partial.duration, pessimistic: partial.duration },
    ...partial,
  };
}

describe('topoSort', () => {
  it('mengurutkan tugas sesuai ketergantungan', () => {
    const tasks = [
      makeTask({ id: 'b', name: 'B', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 1 }),
    ];
    const { order, hasCycle } = topoSort(tasks);
    expect(hasCycle).toBe(false);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
  });

  it('mendeteksi siklus', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'b', name: 'B', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
    ];
    expect(topoSort(tasks).hasCycle).toBe(true);
  });
});

describe('computeSchedule (CPM)', () => {
  it('menjadwalkan rantai FS sederhana', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 3 }), // Sen-Rab
      makeTask({
        id: 'b',
        name: 'B',
        startDate: '2026-10-12',
        duration: 2,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
      }),
    ];
    const res = computeSchedule(tasks, cal);
    expect(res.schedules.a.start).toBe('2026-10-12');
    expect(res.schedules.a.end).toBe('2026-10-14');
    // FS tanpa lag: mulai hari kerja berikutnya setelah A selesai
    expect(res.schedules.b.start).toBe('2026-10-15');
    expect(res.schedules.b.end).toBe('2026-10-16');
    expect(res.hasCycle).toBe(false);
  });

  it('menghormati lag (jeda) pada FS', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 2 }),
      makeTask({
        id: 'b',
        name: 'B',
        startDate: '2026-10-12',
        duration: 1,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 3 }],
      }),
    ];
    const res = computeSchedule(tasks, cal);
    // A mulai Sen 12 Okt, 2 hari kerja -> selesai Sel 13 Okt.
    // FS default mulai Rab 14 Okt, +3 hari kerja lag (15, 16, 19) -> Sen 19 Okt.
    expect(res.schedules.a.end).toBe('2026-10-13');
    expect(res.schedules.b.start).toBe('2026-10-19');
  });

  it('mendukung hubungan Start-to-Start dengan lag', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 5 }),
      makeTask({
        id: 'b',
        name: 'B',
        startDate: '2026-10-12',
        duration: 2,
        dependencies: [{ taskId: 'a', type: 'SS', lag: 2 }],
      }),
    ];
    const res = computeSchedule(tasks, cal);
    // B mulai 2 hari kerja setelah A: Rab 14 Okt
    expect(res.schedules.b.start).toBe('2026-10-14');
  });

  it('tanggal mulai manual menjadi batas bawah (tidak dimajukan oleh user)', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 1 }),
      makeTask({
        id: 'b',
        name: 'B',
        startDate: '2026-10-20', // user minta mulai Sel 20 Okt
        duration: 1,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
      }),
    ];
    const res = computeSchedule(tasks, cal);
    expect(res.schedules.b.start).toBe('2026-10-20');
  });

  it('menghitung slack dan jalur kritis', () => {
    // Cabang a -> c adalah jalur terpanjang (3+2 = 5 hari kerja).
    // Cabang a -> b lebih pendek (3+1 = 4 hari kerja) sehingga B punya slack.
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 3 }),
      makeTask({ id: 'b', name: 'B', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({
        id: 'c',
        name: 'C',
        startDate: '2026-10-12',
        duration: 2,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
      }),
    ];
    const res = computeSchedule(tasks, cal);
    expect(res.schedules.a.critical).toBe(true);
    expect(res.schedules.c.critical).toBe(true);
    expect(res.schedules.b.critical).toBe(false);
    expect(res.schedules.b.slack).toBeGreaterThan(0);
    expect(res.criticalPathIds).toEqual(['a', 'c']);
    // Proyek: A(3) + C(2) = 5 hari kerja, 12..16 Okt
    expect(res.projectStart).toBe('2026-10-12');
    expect(res.projectEnd).toBe('2026-10-16');
    expect(res.projectDuration).toBe(5);
  });

  it('tahan terhadap data bersiklus tanpa crash', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'b', name: 'B', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
    ];
    const res = computeSchedule(tasks, cal);
    expect(res.hasCycle).toBe(true);
    expect(res.schedules.a.start).toBeTruthy();
    expect(res.schedules.b.start).toBeTruthy();
  });

  it('durasi proyek melewati akhir pekan dengan benar', () => {
    // Jumat 16 Okt durasi 3 hari kerja -> Jumat(1), Senin(2), Selasa(3) = 20 Okt
    const tasks = [makeTask({ id: 'a', name: 'A', startDate: '2026-10-16', duration: 3 })];
    const res = computeSchedule(tasks, cal);
    expect(res.schedules.a.start).toBe('2026-10-16');
    expect(res.schedules.a.end).toBe('2026-10-20');
    expect(res.projectDuration).toBe(3);
  });
});
