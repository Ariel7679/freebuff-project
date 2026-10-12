import type { CalendarConfig, Task } from '../types';
import { fromIndex, toIndex } from './calendar';
import { topoSort } from './schedule';

export interface PertNode {
  id: string;
  name: string;
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
  /** Durasi ekspektasi (O + 4M + P) / 6. */
  expected: number;
  /** Variasi ((P - O) / 6)^2. */
  variance: number;
  startIdx: number;
  /** Finish time eksklusif (start + expected). */
  endIdx: number;
  lateStart: number;
  slack: number;
  critical: boolean;
  /** Kolom tata letak diagram (level topologis). */
  level: number;
  /** Baris tata letak diagram. */
  row: number;
}

export interface PertEdge {
  from: string;
  to: string;
  type: 'FS' | 'SS';
  lag: number;
  critical: boolean;
}

export interface PertResult {
  nodes: PertNode[];
  nodeById: Record<string, PertNode>;
  edges: PertEdge[];
  expectedDuration: number;
  totalVariance: number;
  stddev: number;
  startIdx: number;
  endIdx: number;
  start: string;
  end: string;
  criticalIds: string[];
}

export function expectedDuration(estimate: { optimistic: number; mostLikely: number; pessimistic: number }): number {
  const o = Math.max(0, estimate.optimistic);
  const m = Math.max(0, estimate.mostLikely);
  const p = Math.max(0, estimate.pessimistic);
  return (o + 4 * m + p) / 6;
}

export function varianceOf(estimate: { optimistic: number; mostLikely: number; pessimistic: number }): number {
  const o = Math.max(0, estimate.optimistic);
  const p = Math.max(0, estimate.pessimistic);
  return ((p - o) / 6) ** 2;
}

/** Estimasi PERT dari task; bila belum diisi, pakai durasi rencana. */
export function estimateOf(task: Task): { optimistic: number; mostLikely: number; pessimistic: number } {
  const base = Math.max(1, task.duration);
  const o = task.pert?.optimistic ?? base;
  const m = task.pert?.mostLikely ?? base;
  const p = task.pert?.pessimistic ?? base;
  return { optimistic: o, mostLikely: m, pessimistic: Math.max(o, p) };
}

/**
 * Diagram PERT: forward/backward pass dengan durasi ekspektasi (float),
 * tata letak berdasarkan level topologis terpanjang.
 */
export function computePert(tasks: Task[], cal: CalendarConfig): PertResult {
  const known = new Set(tasks.map((t) => t.id));
  const { order } = topoSort(tasks);
  const est = new Map<string, ReturnType<typeof estimateOf>>();
  const exp = new Map<string, number>();
  for (const t of tasks) {
    const e = estimateOf(t);
    est.set(t.id, e);
    exp.set(t.id, expectedDuration(e));
  }

  const start = new Map<string, number>();
  const end = new Map<string, number>();
  const level = new Map<string, number>();

  for (const id of order) {
    const task = tasks.find((t) => t.id === id)!;
    let earliest = toIndex(task.startDate, cal);
    let lvl = 0;
    for (const dep of task.dependencies) {
      if (dep.taskId === task.id || !known.has(dep.taskId)) continue;
      const ps = start.get(dep.taskId);
      const pe = end.get(dep.taskId);
      const pl = level.get(dep.taskId) ?? 0;
      if (ps === undefined || pe === undefined) continue;
      const lag = Math.max(0, Math.round(dep.lag) || 0);
      const cand = dep.type === 'FS' ? pe + lag : ps + lag;
      if (cand > earliest) earliest = cand;
      if (pl + 1 > lvl) lvl = pl + 1;
    }
    start.set(id, earliest);
    end.set(id, earliest + (exp.get(id) ?? 1));
    level.set(id, lvl);
  }

  const starts = [...start.values()];
  const ends = [...end.values()];
  const projStart = starts.length > 0 ? Math.min(...starts) : 0;
  const projEnd = ends.length > 0 ? Math.max(...ends) : 0;

  // Backward
  const successors = new Map<string, { taskId: string; dep: { type: 'FS' | 'SS'; lag: number } }[]>();
  for (const t of tasks) {
    if (!known.has(t.id)) continue;
    for (const dep of t.dependencies) {
      if (!start.has(dep.taskId)) continue;
      const list = successors.get(dep.taskId) ?? [];
      list.push({ taskId: t.id, dep: { type: dep.type, lag: Math.max(0, Math.round(dep.lag) || 0) } });
      successors.set(dep.taskId, list);
    }
  }
  const lateStart = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const duration = exp.get(id) ?? 1;
    const succs = successors.get(id) ?? [];
    if (succs.length === 0) {
      lateStart.set(id, projEnd - duration);
      continue;
    }
    let lf = Number.POSITIVE_INFINITY;
    for (const { taskId, dep } of succs) {
      const ls = lateStart.get(taskId);
      if (ls === undefined) continue;
      const cand = dep.type === 'FS' ? ls - dep.lag : ls - dep.lag + duration;
      if (cand < lf) lf = cand;
    }
    if (!Number.isFinite(lf)) lf = projEnd;
    const es = start.get(id) ?? 0;
    const maxLf = es + duration;
    if (lf < maxLf) lf = maxLf;
    lateStart.set(id, lf - duration);
  }

  // Tata letak: kelompokkan per level, urut sesuai urutan topologis
  const byLevel = new Map<number, string[]>();
  for (const id of order) {
    const lv = level.get(id) ?? 0;
    const list = byLevel.get(lv) ?? [];
    list.push(id);
    byLevel.set(lv, list);
  }
  const rowOf = new Map<string, number>();
  for (const [, ids] of byLevel) {
    ids.forEach((id, i) => rowOf.set(id, i));
  }

  const nodes: PertNode[] = order.map((id) => {
    const task = tasks.find((t) => t.id === id)!;
    const e = est.get(id)!;
    const es = start.get(id) ?? 0;
    const ls = lateStart.get(id) ?? es;
    const slack = Math.max(0, ls - es);
    return {
      id,
      name: task.name,
      optimistic: e.optimistic,
      mostLikely: e.mostLikely,
      pessimistic: e.pessimistic,
      expected: exp.get(id) ?? 1,
      variance: varianceOf(e),
      startIdx: es,
      endIdx: end.get(id) ?? es,
      lateStart: ls,
      slack,
      critical: slack < 1e-6,
      level: level.get(id) ?? 0,
      row: rowOf.get(id) ?? 0,
    };
  });

  const nodeById: Record<string, PertNode> = {};
  for (const n of nodes) nodeById[n.id] = n;

  const edges: PertEdge[] = [];
  for (const t of tasks) {
    if (!known.has(t.id)) continue;
    for (const dep of t.dependencies) {
      if (!known.has(dep.taskId)) continue;
      const p = nodeById[dep.taskId];
      const c = nodeById[t.id];
      if (!p || !c) continue;
      edges.push({
        from: dep.taskId,
        to: t.id,
        type: dep.type,
        lag: Math.max(0, Math.round(dep.lag) || 0),
        critical: p.critical && c.critical,
      });
    }
  }

  const criticalIds = order.filter((id) => nodeById[id]?.critical);
  const criticalVariance = criticalIds.reduce((acc, id) => acc + (nodeById[id]?.variance ?? 0), 0);

  return {
    nodes,
    nodeById,
    edges,
    expectedDuration: projEnd - projStart,
    totalVariance: criticalVariance,
    stddev: Math.sqrt(criticalVariance),
    startIdx: projStart,
    endIdx: projEnd,
    start: fromIndex(Math.round(projStart), cal),
    end: fromIndex(Math.max(0, Math.round(projEnd - 1e-9)), cal),
    criticalIds,
  };
}
