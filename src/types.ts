export type Priority = 'Low' | 'Medium' | 'High';
export type LinkType = 'FS' | 'SS';

/** Tiga titik estimasi PERT (dalam hari kerja). */
export interface PertEstimate {
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
}

/** Ketergantungan antar tugas dengan lag (jeda hari kerja). */
export interface Dependency {
  taskId: string;
  type: LinkType;
  lag: number;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  /** Batas awal tercepat yang diinginkan user (ISO yyyy-mm-dd). */
  startDate: string;
  /** Durasi dalam hari kerja. */
  duration: number;
  priority: Priority;
  color: string;
  parentId: string | null;
  collapsed: boolean;
  dependencies: Dependency[];
  assigneeIds: string[];
  /** Progres penyelesaian 0-100. */
  progress: number;
  pert: PertEstimate;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Gaji per bulan (IDR). */
  salary: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface CalendarConfig {
  /** Hari akhir pekan: 0=Minggu .. 6=Sabtu. */
  weekendDays: number[];
  holidays: Holiday[];
}

export interface ProjectState {
  projectName: string;
  startDate: string;
  tasks: Task[];
  members: Member[];
  calendar: CalendarConfig;
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  Low: '#3b82f6',
  Medium: '#f59e0b',
  High: '#ef4444',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  Low: 'Rendah',
  Medium: 'Sedang',
  High: 'Tinggi',
};

export const COLOR_SWATCHES = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#64748b',
];

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
