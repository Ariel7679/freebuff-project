import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CalendarConfig, Holiday, Member, Priority, ProjectState, Task } from '../types';
import { uid } from '../types';
import { createSeedState } from '../data/seed';
import { loadState, saveState } from '../lib/storage';
import { computeSchedule, type ScheduleResult } from '../lib/schedule';

export interface NewTaskInput {
  name: string;
  description?: string;
  startDate?: string;
  duration?: number;
  priority?: Priority;
  color?: string;
  parentId?: string | null;
}

interface StoreValue {
  state: ProjectState;
  schedule: ScheduleResult;
  addTask: (input: NewTaskInput) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleCollapse: (id: string) => void;
  addMember: (input: Omit<Member, 'id'>) => void;
  updateMember: (id: string, patch: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  addHoliday: (date: string, name: string) => void;
  removeHoliday: (id: string) => void;
  toggleWeekendDay: (day: number) => void;
  setProjectName: (name: string) => void;
  resetData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4'];

function initialState(): ProjectState {
  return loadState() ?? createSeedState();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProjectState>(initialState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const schedule = useMemo(() => computeSchedule(state.tasks, state.calendar), [state.tasks, state.calendar]);

  const addTask = useCallback((input: NewTaskInput): string => {
    const id = uid('t');
    setState((prev) => {
      const color = input.color ?? COLORS[prev.tasks.length % COLORS.length];
      const duration = Math.max(1, input.duration ?? 3);
      const task: Task = {
        id,
        name: input.name.trim() || 'Tugas baru',
        description: input.description ?? '',
        startDate: input.startDate ?? prev.startDate,
        duration,
        priority: input.priority ?? 'Medium',
        color,
        parentId: input.parentId ?? null,
        collapsed: false,
        dependencies: [],
        assigneeIds: [],
        progress: 0,
        pert: { optimistic: duration, mostLikely: duration, pessimistic: duration },
      };
      return { ...prev, tasks: [...prev.tasks, task] };
    });
    return id;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((prev) => {
      const doomed = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of prev.tasks) {
          if (t.parentId && doomed.has(t.parentId) && !doomed.has(t.id)) {
            doomed.add(t.id);
            grew = true;
          }
        }
      }
      const tasks = prev.tasks
        .filter((t) => !doomed.has(t.id))
        .map((t) => ({
          ...t,
          dependencies: t.dependencies.filter((d) => !doomed.has(d.taskId)),
          parentId: t.parentId && doomed.has(t.parentId) ? null : t.parentId,
        }));
      return { ...prev, tasks };
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, collapsed: !t.collapsed } : t)),
    }));
  }, []);

  const addMember = useCallback((input: Omit<Member, 'id'>) => {
    setState((prev) => ({ ...prev, members: [...prev.members, { ...input, id: uid('m') }] }));
  }, []);

  const updateMember = useCallback((id: string, patch: Partial<Member>) => {
    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === id ? { ...m, ...patch, id: m.id } : m)),
    }));
  }, []);

  const deleteMember = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
      tasks: prev.tasks.map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((a) => a !== id) })),
    }));
  }, []);

  const addHoliday = useCallback((date: string, name: string) => {
    setState((prev) => {
      if (prev.calendar.holidays.some((h) => h.date === date)) return prev;
      const holiday: Holiday = { id: uid('h'), date, name: name.trim() || 'Hari Libur' };
      return { ...prev, calendar: { ...prev.calendar, holidays: [...prev.calendar.holidays, holiday].sort((a, b) => a.date.localeCompare(b.date)) } };
    });
  }, []);

  const removeHoliday = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      calendar: { ...prev.calendar, holidays: prev.calendar.holidays.filter((h) => h.id !== id) },
    }));
  }, []);

  const toggleWeekendDay = useCallback((day: number) => {
    setState((prev) => {
      const has = prev.calendar.weekendDays.includes(day);
      const weekendDays = has ? prev.calendar.weekendDays.filter((d) => d !== day) : [...prev.calendar.weekendDays, day].sort((a, b) => a - b);
      const calendar: CalendarConfig = { ...prev.calendar, weekendDays };
      return { ...prev, calendar };
    });
  }, []);

  const setProjectName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, projectName: name }));
  }, []);

  const resetData = useCallback(() => {
    setState(createSeedState());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      schedule,
      addTask,
      updateTask,
      deleteTask,
      toggleCollapse,
      addMember,
      updateMember,
      deleteMember,
      addHoliday,
      removeHoliday,
      toggleWeekendDay,
      setProjectName,
      resetData,
    }),
    [
      state,
      schedule,
      addTask,
      updateTask,
      deleteTask,
      toggleCollapse,
      addMember,
      updateMember,
      deleteMember,
      addHoliday,
      removeHoliday,
      toggleWeekendDay,
      setProjectName,
      resetData,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore harus dipakai di dalam StoreProvider');
  return ctx;
}
