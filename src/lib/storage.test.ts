import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedState, STORAGE_KEY } from '../data/seed';
import { clearState, loadState, normalizeState, saveState } from './storage';

describe('storage (localStorage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('menyimpan dan memuat ulang state', () => {
    const state = createSeedState();
    saveState(state);
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.tasks.length).toBe(state.tasks.length);
    expect(loaded!.members.length).toBe(state.members.length);
    expect(loaded!.tasks[0].name).toBe(state.tasks[0].name);
    expect(loaded!.calendar.weekendDays).toEqual([0, 6]);
    expect(loaded!.calendar.holidays.length).toBe(state.calendar.holidays.length);
  });

  it('mengembalikan null untuk data rusak', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }));
    expect(loadState()).toBeNull();
  });

  it('clearState menghapus data tersimpan', () => {
    saveState(createSeedState());
    clearState();
    expect(loadState()).toBeNull();
  });

  it('normalizeState membuang tugas tak valid dan merapikan field', () => {
    const raw = {
      projectName: 'X',
      startDate: '2026-10-12',
      members: [{ id: 'm1', name: 'A', email: 'a@b.c', role: 'Dev', salary: 1000 }, { nope: true }],
      calendar: { weekendDays: [0, 6, 99], holidays: [{ id: 'h', date: '2026-12-25', name: 'Natal' }, { bad: 1 }] },
      tasks: [
        { id: 't1', name: 'Tugas', startDate: '2026-10-12', duration: 2, priority: 'High', dependencies: [{ taskId: 'x', type: 'SS', lag: 2 }] },
        { name: 'Tanpa Id' },
        { id: 't2', name: 'Durasi Aneh', startDate: '2026-10-12', duration: -5, priority: 'Unknown' },
      ],
    };
    const res = normalizeState(raw)!;
    expect(res.tasks.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(res.tasks[0].dependencies).toEqual([{ taskId: 'x', type: 'SS', lag: 2 }]);
    expect(res.tasks[1].duration).toBe(1);
    expect(res.tasks[1].priority).toBe('Medium');
    expect(res.members.length).toBe(1);
    expect(res.calendar.weekendDays).toEqual([0, 6]);
    expect(res.calendar.holidays.length).toBe(1);
  });
});
