import type { CalendarConfig, Member, ProjectState, Task } from '../types';
import { uid } from '../types';

export const STORAGE_KEY = 'freebuff-project-state-v1';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4'];

function task(partial: Partial<Task> & { id: string; name: string; startDate: string; duration: number }): Task {
  return {
    description: '',
    priority: 'Medium',
    color: COLORS[5],
    parentId: null,
    collapsed: false,
    dependencies: [],
    assigneeIds: [],
    progress: 0,
    pert: { optimistic: partial.duration, mostLikely: partial.duration, pessimistic: partial.duration },
    ...partial,
  } as Task;
}

export function createSeedState(): ProjectState {
  const t1 = 't_analisis';
  const t1a = 't_data';
  const t1b = 't_wawancara';
  const t1c = 't_spek';
  const t2 = 't_desain';
  const t2a = 't_uiux';
  const t2b = 't_db';
  const t3 = 't_dev';
  const t3a = 't_env';
  const t3b = 't_api';
  const t3c = 't_fe';
  const t3d = 't_integ';
  const t4 = 't_uji';
  const t4a = 't_unit';
  const t4b = 't_uat';
  const t5 = 't_rilis';

  const m1 = 'm_ariel';
  const m2 = 'm_siti';
  const m3 = 'm_budi';
  const m4 = 'm_maya';

  const tasks: Task[] = [
    task({
      id: t1,
      name: 'Analisis Kebutuhan',
      startDate: '2026-10-12',
      duration: 3,
      priority: 'High',
      color: '#ef4444',
      pert: { optimistic: 2, mostLikely: 3, pessimistic: 6 },
    }),
    task({
      id: t1a,
      name: 'Pengumpulan Data',
      startDate: '2026-10-12',
      duration: 2,
      parentId: t1,
      color: '#f97316',
      assigneeIds: [m2],
      pert: { optimistic: 1, mostLikely: 2, pessimistic: 4 },
    }),
    task({
      id: t1b,
      name: 'Wawancara Stakeholder',
      startDate: '2026-10-13',
      duration: 2,
      parentId: t1,
      color: '#f97316',
      dependencies: [{ taskId: t1a, type: 'FS', lag: 0 }],
      assigneeIds: [m1, m2],
      pert: { optimistic: 1, mostLikely: 2, pessimistic: 5 },
    }),
    task({
      id: t1c,
      name: 'Dokumen Spesifikasi',
      startDate: '2026-10-15',
      duration: 2,
      parentId: t1,
      priority: 'High',
      color: '#ef4444',
      dependencies: [{ taskId: t1b, type: 'FS', lag: 0 }],
      assigneeIds: [m1],
      pert: { optimistic: 1, mostLikely: 2, pessimistic: 4 },
    }),
    task({
      id: t2,
      name: 'Desain Sistem',
      startDate: '2026-10-20',
      duration: 3,
      priority: 'Medium',
      color: '#f59e0b',
      dependencies: [{ taskId: t1c, type: 'FS', lag: 1 }],
      pert: { optimistic: 2, mostLikely: 3, pessimistic: 5 },
    }),
    task({
      id: t2a,
      name: 'Desain UI/UX',
      startDate: '2026-10-20',
      duration: 3,
      parentId: t2,
      color: '#ec4899',
      dependencies: [{ taskId: t1c, type: 'FS', lag: 1 }],
      assigneeIds: [m4],
      pert: { optimistic: 2, mostLikely: 3, pessimistic: 6 },
    }),
    task({
      id: t2b,
      name: 'Desain Database',
      startDate: '2026-10-21',
      duration: 2,
      parentId: t2,
      color: '#06b6d4',
      dependencies: [{ taskId: t2a, type: 'SS', lag: 1 }],
      assigneeIds: [m3],
      pert: { optimistic: 1, mostLikely: 2, pessimistic: 4 },
    }),
    task({
      id: t3,
      name: 'Pengembangan',
      startDate: '2026-10-26',
      duration: 5,
      priority: 'High',
      color: '#8b5cf6',
      dependencies: [{ taskId: t2a, type: 'FS', lag: 0 }],
      pert: { optimistic: 4, mostLikely: 5, pessimistic: 9 },
    }),
    task({
      id: t3a,
      name: 'Setup Environment',
      startDate: '2026-10-26',
      duration: 1,
      parentId: t3,
      color: '#10b981',
      dependencies: [{ taskId: t2b, type: 'FS', lag: 0 }],
      assigneeIds: [m3],
      pert: { optimistic: 1, mostLikely: 1, pessimistic: 2 },
    }),
    task({
      id: t3b,
      name: 'Backend API',
      startDate: '2026-10-27',
      duration: 4,
      parentId: t3,
      priority: 'High',
      color: '#ef4444',
      dependencies: [{ taskId: t3a, type: 'FS', lag: 0 }],
      assigneeIds: [m3],
      pert: { optimistic: 3, mostLikely: 4, pessimistic: 7 },
    }),
    task({
      id: t3c,
      name: 'Frontend Aplikasi',
      startDate: '2026-10-28',
      duration: 4,
      parentId: t3,
      color: '#3b82f6',
      dependencies: [{ taskId: t3b, type: 'SS', lag: 2 }],
      assigneeIds: [m2, m4],
      pert: { optimistic: 3, mostLikely: 4, pessimistic: 8 },
    }),
    task({
      id: t3d,
      name: 'Integrasi Modul',
      startDate: '2026-11-03',
      duration: 2,
      parentId: t3,
      color: '#8b5cf6',
      dependencies: [
        { taskId: t3b, type: 'FS', lag: 1 },
        { taskId: t3c, type: 'FS', lag: 0 },
      ],
      assigneeIds: [m3, m2],
      pert: { optimistic: 1, mostLikely: 2, pessimistic: 5 },
    }),
    task({
      id: t4,
      name: 'Pengujian',
      startDate: '2026-11-06',
      duration: 3,
      priority: 'Medium',
      color: '#f59e0b',
      dependencies: [{ taskId: t3d, type: 'FS', lag: 0 }],
      pert: { optimistic: 2, mostLikely: 3, pessimistic: 6 },
    }),
    task({
      id: t4a,
      name: 'Unit Test',
      startDate: '2026-11-06',
      duration: 2,
      parentId: t4,
      color: '#10b981',
      dependencies: [{ taskId: t3d, type: 'FS', lag: 0 }],
      assigneeIds: [m4],
      pert: { optimistic: 1, mostLikely: 2, pessimistic: 3 },
    }),
    task({
      id: t4b,
      name: 'UAT Stakeholder',
      startDate: '2026-11-10',
      duration: 2,
      parentId: t4,
      color: '#ec4899',
      dependencies: [
        { taskId: t4a, type: 'FS', lag: 0 },
        { taskId: t3d, type: 'FS', lag: 0 },
      ],
      assigneeIds: [m1, m2],
      pert: { optimistic: 1, mostLikely: 2, pessimistic: 6 },
    }),
    task({
      id: t5,
      name: 'Peluncuran Produk',
      startDate: '2026-11-13',
      duration: 1,
      priority: 'High',
      color: '#ef4444',
      dependencies: [{ taskId: t4b, type: 'FS', lag: 1 }],
      assigneeIds: [m1],
      pert: { optimistic: 1, mostLikely: 1, pessimistic: 3 },
    }),
  ];

  const members: Member[] = [
    { id: m1, name: 'Ariel Pratama', email: 'ariel@freebuff.id', role: 'Project Manager', salary: 18_000_000 },
    { id: m2, name: 'Siti Rahayu', email: 'siti@freebuff.id', role: 'Frontend Developer', salary: 12_500_000 },
    { id: m3, name: 'Budi Santoso', email: 'budi@freebuff.id', role: 'Backend Developer', salary: 13_000_000 },
    { id: m4, name: 'Maya Lestari', email: 'maya@freebuff.id', role: 'UI/UX Designer & QA', salary: 11_000_000 },
  ];

  const calendar: CalendarConfig = {
    weekendDays: [0, 6],
    holidays: [
      { id: uid('h'), date: '2026-10-26', name: 'Hari Santri Nasional' },
      { id: uid('h'), date: '2026-12-25', name: 'Hari Natal' },
      { id: uid('h'), date: '2027-01-01', name: 'Tahun Baru Masehi' },
    ],
  };

  return {
    projectName: 'Proyek Portal Manajemen Proyek',
    startDate: '2026-10-12',
    tasks,
    members,
    calendar,
  };
}
