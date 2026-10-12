import type { CalendarConfig, Dependency, Task } from '../types';
import { durationEndDate, fromIndex, toIndex } from './calendar';

export interface TaskSchedule {
  id: string;
  /** Indeks hari kerja (0-based) hari mulai. */
  startIdx: number;
  /** Indeks hari kerja hari selesai (inklusif). */
  endIdx: number;
  start: string;
  end: string;
  lateStartIdx: number;
  lateEndIdx: number;
  /** Jumlah hari kerja yang bisa ditunda (0 = kritis). */
  slack: number;
  critical: boolean;
}

export interface ScheduleResult {
  order: string[];
  schedules: Record<string, TaskSchedule>;
  projectStartIdx: number;
  projectEndIdx: number;
  projectStart: string;
  projectEnd: string;
  /** Durasi proyek dalam hari kerja. */
  projectDuration: number;
  /** rantai jalur kritis (urut dari awal ke akhir). */
  criticalPathIds: string[];
  hasCycle: boolean;
}

/** Urutkan tugas topologis; bila ada siklus, sisa tugas diurutkan apa adanya. */
export function topoSort(tasks: Task[]): { order: string[]; hasCycle: boolean } {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    indeg.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (dep.taskId === t.id || !byId.has(dep.taskId)) continue;
      indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1);
      adj.get(dep.taskId)!.push(t.id);
    }
  }
  const queue = tasks.filter((t) => (indeg.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const succ of adj.get(id) ?? []) {
      const n = (indeg.get(succ) ?? 0) - 1;
      indeg.set(succ, n);
      if (n === 0) queue.push(succ);
    }
  }
  const hasCycle = order.length !== tasks.length;
  if (hasCycle) {
    const seen = new Set(order);
    for (const t of tasks) if (!seen.has(t.id)) order.push(t.id);
  }
  return { order, hasCycle };
}

function validDeps(task: Task, known: Set<string>): Dependency[] {
  return task.dependencies.filter((d) => d.taskId !== task.id && known.has(d.taskId));
}

/**
 * Perhitungan CPM pada ruang indeks hari kerja:
 * - Forward pass: earliest start = maks(user start, batas predecessor FS/SS + lag).
 * - Backward pass: latest finish = min(latest start successor - lag), akhir proyek = end terjauh.
 * - Slack = late start - earliest start; slack <= 0 dianggap jalur kritis.
 */
export function computeSchedule(tasks: Task[], cal: CalendarConfig): ScheduleResult {
  const known = new Set(tasks.map((t) => t.id));
  const { order, hasCycle } = topoSort(tasks);

  const startIdx = new Map<string, number>();
  const endIdx = new Map<string, number>();
  const dur = new Map<string, number>();

  // ---- Forward pass ----
  for (const id of order) {
    const task = tasks.find((t) => t.id === id)!;
    const duration = Math.max(1, Math.round(task.duration) || 1);
    dur.set(id, duration);

    let earliest = toIndex(task.startDate, cal);
    for (const dep of validDeps(task, known)) {
      const ps = startIdx.get(dep.taskId);
      const pe = endIdx.get(dep.taskId);
      if (ps === undefined || pe === undefined) continue; // bagian dari siklus
      const lag = Math.max(0, Math.round(dep.lag) || 0);
      const cand = dep.type === 'FS' ? pe + 1 + lag : ps + lag;
      if (cand > earliest) earliest = cand;
    }
    startIdx.set(id, earliest);
    endIdx.set(id, earliest + duration - 1);
  }

  const ends = [...endIdx.values()];
  const starts = [...startIdx.values()];
  const projectEndIdx = ends.length > 0 ? Math.max(...ends) : 0;
  const projectStartIdx = starts.length > 0 ? Math.min(...starts) : 0;

  // ---- Backward pass ----
  const successors = new Map<string, { taskId: string; dep: Dependency }[]>();
  for (const t of tasks) {
    for (const dep of validDeps(t, known)) {
      if (!startIdx.has(dep.taskId)) continue;
      const list = successors.get(dep.taskId) ?? [];
      list.push({ taskId: t.id, dep });
      successors.set(dep.taskId, list);
    }
  }

  const lateStart = new Map<string, number>();
  const lateEnd = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const duration = dur.get(id) ?? 1;
    const succs = successors.get(id) ?? [];
    if (succs.length === 0) {
      const lf = projectEndIdx;
      lateEnd.set(id, lf);
      lateStart.set(id, lf - duration + 1);
      continue;
    }
    let lf = Number.POSITIVE_INFINITY;
    for (const { taskId, dep } of succs) {
      const ls = lateStart.get(taskId);
      if (ls === undefined) continue;
      const lag = Math.max(0, Math.round(dep.lag) || 0);
      const cand = dep.type === 'FS' ? ls - lag - 1 : ls - lag + duration - 1;
      if (cand < lf) lf = cand;
    }
    if (!Number.isFinite(lf)) lf = projectEndIdx;
    if (lf < (endIdx.get(id) ?? lf)) lf = endIdx.get(id)!; // jangan lebih awal dari earliest
    lateEnd.set(id, lf);
    lateStart.set(id, lf - duration + 1);
  }

  // ---- Bangun hasil ----
  const schedules: Record<string, TaskSchedule> = {};
  for (const task of tasks) {
    const id = task.id;
    const s = startIdx.get(id) ?? 0;
    const e = endIdx.get(id) ?? s;
    const ls = lateStart.get(id) ?? s;
    const le = lateEnd.get(id) ?? e;
    const slack = Math.max(0, ls - s);
    schedules[id] = {
      id,
      startIdx: s,
      endIdx: e,
      start: fromIndex(s, cal),
      end: fromIndex(e, cal),
      lateStartIdx: ls,
      lateEndIdx: le,
      slack,
      critical: slack === 0,
    };
  }

  const criticalPathIds = traceCriticalPath(tasks, schedules, order, projectEndIdx, known);

  return {
    order,
    schedules,
    projectStartIdx,
    projectEndIdx,
    projectStart: fromIndex(projectStartIdx, cal),
    projectEnd: fromIndex(projectEndIdx, cal),
    projectDuration: projectEndIdx - projectStartIdx + 1,
    criticalPathIds,
    hasCycle,
  };
}

/** Telusuri rantai kritis dari tugas akhir proyek mundur ke tugas awal. */
function traceCriticalPath(
  tasks: Task[],
  schedules: Record<string, TaskSchedule>,
  order: string[],
  projectEndIdx: number,
  known: Set<string>,
): string[] {
  const criticalTasks = order.filter((id) => schedules[id]?.critical);
  if (criticalTasks.length === 0) return [];

  let tail = criticalTasks.find((id) => schedules[id].endIdx === projectEndIdx) ?? criticalTasks[criticalTasks.length - 1];
  const chain: string[] = [tail];
  const guard = new Set<string>([tail]);

  while (true) {
    const cur = schedules[tail];
    const task = tasks.find((t) => t.id === tail)!;
    let nextId: string | null = null;
    for (const dep of validDeps(task, known)) {
      const p = schedules[dep.taskId];
      if (!p || !p.critical || guard.has(dep.taskId)) continue;
      const tight =
        dep.type === 'FS'
          ? p.endIdx + 1 + Math.max(0, dep.lag) === cur.startIdx
          : p.startIdx + Math.max(0, dep.lag) === cur.startIdx;
      if (tight) {
        nextId = dep.taskId;
        break;
      }
    }
    if (!nextId) break;
    chain.unshift(nextId);
    guard.add(nextId);
    tail = nextId;
  }
  return chain;
}

/** Hitung akhir tugas berdasarkan durasi hari kerja. */
export function taskEnd(task: Task, cal: CalendarConfig): string {
  return durationEndDate(task.startDate, task.duration, cal);
}
