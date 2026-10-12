import { describe, expect, it } from 'vitest';
import type { CalendarConfig, Task } from '../types';
import { computePert, estimateOf, expectedDuration, varianceOf } from './pert';

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

describe('PERT (estimasi tiga titik)', () => {
  it('expectedDuration = (O + 4M + P) / 6', () => {
    expect(expectedDuration({ optimistic: 4, mostLikely: 6, pessimistic: 16 })).toBeCloseTo(7.3333, 3);
    expect(expectedDuration({ optimistic: 2, mostLikely: 2, pessimistic: 2 })).toBe(2);
  });

  it('varianceOf = ((P - O) / 6)^2', () => {
    expect(varianceOf({ optimistic: 4, mostLikely: 6, pessimistic: 16 })).toBeCloseTo(4, 5);
    expect(varianceOf({ optimistic: 3, mostLikely: 3, pessimistic: 3 })).toBe(0);
  });

  it('estimateOf memakai durasi rencana bila estimasi kosong', () => {
    const t = makeTask({ id: 'x', name: 'X', startDate: '2026-10-12', duration: 5, pert: { optimistic: 0, mostLikely: 0, pessimistic: 0 } });
    // pert terisi 0 -> expectedDuration tetap pakai nilai task
    expect(estimateOf(t)).toEqual({ optimistic: 0, mostLikely: 0, pessimistic: 0 });
    const t2 = makeTask({ id: 'y', name: 'Y', startDate: '2026-10-12', duration: 5 });
    expect(estimateOf(t2)).toEqual({ optimistic: 5, mostLikely: 5, pessimistic: 5 });
  });

  it('menghitung durasi ekspektasi proyek dan varian jalur kritis', () => {
    const tasks = [
      makeTask({
        id: 'a',
        name: 'A',
        startDate: '2026-10-12',
        duration: 4,
        pert: { optimistic: 2, mostLikely: 4, pessimistic: 6 },
      }),
      makeTask({
        id: 'b',
        name: 'B',
        startDate: '2026-10-12',
        duration: 4,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
        pert: { optimistic: 4, mostLikely: 5, pessimistic: 16 },
      }),
    ];
    const res = computePert(tasks, cal);
    const ea = expectedDuration({ optimistic: 2, mostLikely: 4, pessimistic: 6 }); // 4
    const eb = expectedDuration({ optimistic: 4, mostLikely: 5, pessimistic: 16 }); // 6.833
    expect(res.expectedDuration).toBeCloseTo(ea + eb, 6);
    expect(res.nodeById.a.expected).toBeCloseTo(ea, 6);
    expect(res.nodeById.b.expected).toBeCloseTo(eb, 6);
    expect(res.criticalIds).toEqual(['a', 'b']);
    // varian jalur kritis = varian A + varian B
    expect(res.totalVariance).toBeCloseTo(
      varianceOf({ optimistic: 2, mostLikely: 4, pessimistic: 6 }) + varianceOf({ optimistic: 4, mostLikely: 5, pessimistic: 16 }),
      6,
    );
    expect(res.stddev).toBeCloseTo(Math.sqrt(res.totalVariance), 6);
  });

  it('menandai cabang yang lebih pendek sebagai tidak kritis', () => {
    // Jalur terpanjang: a(4) -> c(3) -> d(1) = 8 hari kerja.
    // Cabang a(4) -> b(1) berhenti lebih awal sehingga B punya slack.
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 4 }),
      makeTask({ id: 'b', name: 'B', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'c', name: 'C', startDate: '2026-10-12', duration: 3, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'd', name: 'D', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'c', type: 'FS', lag: 0 }] }),
    ];
    const res = computePert(tasks, cal);
    expect(res.nodeById.a.critical).toBe(true);
    expect(res.nodeById.c.critical).toBe(true);
    expect(res.nodeById.d.critical).toBe(true);
    expect(res.nodeById.b.critical).toBe(false);
    expect(res.nodeById.b.slack).toBeGreaterThan(0);
  });

  it('tata letak level diagram bertingkat', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'A', startDate: '2026-10-12', duration: 1 }),
      makeTask({ id: 'b', name: 'B', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'c', name: 'C', startDate: '2026-10-12', duration: 1, dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }] }),
    ];
    const res = computePert(tasks, cal);
    expect(res.nodeById.a.level).toBe(0);
    expect(res.nodeById.b.level).toBe(1);
    expect(res.nodeById.c.level).toBe(2);
    expect(res.edges.some((e) => e.from === 'a' && e.to === 'b')).toBe(true);
  });
});
