import type { CalendarConfig, Member, Priority, ProjectState, Task } from '../types';
import { createSeedState } from '../data/seed';

export const STORAGE_KEY = 'freebuff-project-state-v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

function normalizeTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id, '');
  const name = asString(raw.name, '');
  if (!id || !name) return null;

  const depsRaw = Array.isArray(raw.dependencies) ? raw.dependencies : [];
  const dependencies = depsRaw
    .filter(isRecord)
    .map((d) => ({
      taskId: asString(d.taskId, ''),
      type: d.type === 'SS' ? ('SS' as const) : ('FS' as const),
      lag: Math.max(0, asNumber(d.lag, 0)),
    }))
    .filter((d) => d.taskId !== '');

  const pertRaw = isRecord(raw.pert) ? raw.pert : {};
  const duration = Math.max(1, asNumber(raw.duration, 1));
  const priorityRaw = asString(raw.priority, 'Medium') as Priority;
  const pert = {
    optimistic: Math.max(0, asNumber(pertRaw.optimistic, duration)),
    mostLikely: Math.max(0, asNumber(pertRaw.mostLikely, duration)),
    pessimistic: Math.max(0, asNumber(pertRaw.pessimistic, duration)),
  };

  return {
    id,
    name,
    description: asString(raw.description, ''),
    startDate: asString(raw.startDate, '2026-10-12'),
    duration,
    priority: PRIORITIES.includes(priorityRaw) ? priorityRaw : 'Medium',
    color: asString(raw.color, '#10b981'),
    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    collapsed: raw.collapsed === true,
    dependencies,
    assigneeIds: Array.isArray(raw.assigneeIds) ? raw.assigneeIds.filter((x): x is string => typeof x === 'string') : [],
    progress: Math.min(100, Math.max(0, asNumber(raw.progress, 0))),
    pert: {
      ...pert,
      pessimistic: Math.max(pert.pessimistic, pert.optimistic),
    },
  };
}

function normalizeMember(raw: unknown): Member | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id, '');
  const name = asString(raw.name, '');
  if (!id || !name) return null;
  return {
    id,
    name,
    email: asString(raw.email, ''),
    role: asString(raw.role, ''),
    salary: Math.max(0, asNumber(raw.salary, 0)),
  };
}

function normalizeCalendar(raw: unknown): CalendarConfig {
  const fallback = createSeedState().calendar;
  if (!isRecord(raw)) return fallback;
  const weekendDays = Array.isArray(raw.weekendDays)
    ? raw.weekendDays.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
    : fallback.weekendDays;
  const holidays = Array.isArray(raw.holidays)
    ? raw.holidays
        .filter(isRecord)
        .map((h) => ({ id: asString(h.id, ''), date: asString(h.date, ''), name: asString(h.name, 'Libur') }))
        .filter((h) => h.id !== '' && /^\d{4}-\d{2}-\d{2}$/.test(h.date))
    : fallback.holidays;
  return { weekendDays, holidays };
}

export function normalizeState(raw: unknown): ProjectState | null {
  if (!isRecord(raw)) return null;
  const tasksRaw = Array.isArray(raw.tasks) ? raw.tasks : null;
  if (!tasksRaw) return null;
  const membersRaw = Array.isArray(raw.members) ? raw.members : [];
  const seed = createSeedState();
  return {
    projectName: asString(raw.projectName, seed.projectName),
    startDate: asString(raw.startDate, seed.startDate),
    tasks: tasksRaw.map(normalizeTask).filter((t): t is Task => t !== null),
    members: membersRaw.map(normalizeMember).filter((m): m is Member => m !== null),
    calendar: normalizeCalendar(raw.calendar),
  };
}

export function loadState(): ProjectState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state: ProjectState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage penuh/di-nonaktifkan: abaikan, aplikasi tetap jalan in-memory.
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
