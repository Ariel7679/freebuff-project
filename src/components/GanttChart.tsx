import { useMemo, useRef, useState } from 'react';
import type { Task } from '../types';
import { PRIORITY_LABELS } from '../types';
import { useStore } from '../state/store';
import {
  addDays,
  countWorkdaysInclusive,
  dayDiff,
  dayLetter,
  durationEndDate,
  formatMonthYear,
  formatShort,
  isWorkingDay,
  nextWorkingDay,
  prevWorkingDay,
  todayISO,
} from '../lib/calendar';

const ROW_H = 40;
const LEFT_W = 340;

interface Row {
  task: Task;
  depth: number;
}

interface DragState {
  taskId: string;
  mode: 'move' | 'start' | 'end';
  originX: number;
  origStart: string;
  origEnd: string;
  origDuration: number;
  deltaDays: number;
}

interface GanttProps {
  onEditTask: (task: Task) => void;
  onAddTask: (parentId: string | null) => void;
  highlightCritical: boolean;
  onToggleHighlight: () => void;
}

function buildRows(tasks: Task[]): Row[] {
  const children = new Map<string, Task[]>();
  const roots: Task[] = [];
  for (const t of tasks) {
    if (t.parentId && tasks.some((p) => p.id === t.parentId)) {
      const list = children.get(t.parentId) ?? [];
      list.push(t);
      children.set(t.parentId, list);
    } else {
      roots.push(t);
    }
  }
  const out: Row[] = [];
  const walk = (task: Task, depth: number) => {
    out.push({ task, depth });
    if (task.collapsed) return;
    for (const child of children.get(task.id) ?? []) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return out;
}

export default function GanttChart({ onEditTask, onAddTask, highlightCritical, onToggleHighlight }: GanttProps) {
  const { state, schedule, updateTask, deleteTask, toggleCollapse } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colW, setColW] = useState(34);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const all = buildRows(state.tasks);
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((r) => r.task.name.toLowerCase().includes(q));
  }, [state.tasks, query]);

  const range = useMemo(() => {
    const scheds = Object.values(schedule.schedules);
    const starts = scheds.map((s) => s.start);
    const ends = scheds.map((s) => s.end);
    const min = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : state.startDate;
    const max = ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : state.startDate;
    const start = addDays(min, -4);
    const end = addDays(max, 8);
    return { start, end, days: dayDiff(start, end) + 1 };
  }, [schedule, state.startDate]);

  const days = useMemo(() => {
    const list: { date: string; dow: number }[] = [];
    for (let i = 0; i < range.days; i++) {
      const date = addDays(range.start, i);
      list.push({ date, dow: new Date(`${date}T00:00:00Z`).getUTCDay() });
    }
    return list;
  }, [range]);

  const months = useMemo(() => {
    const out: { label: string; span: number }[] = [];
    for (const d of days) {
      const label = formatMonthYear(d.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.span += 1;
      else out.push({ label, span: 1 });
    }
    return out;
  }, [days]);

  const timelineW = range.days * colW;
  const xOf = (date: string) => dayDiff(range.start, date) * colW;

  // ---- Drag / resize ----
  const startDrag = (e: React.PointerEvent, task: Task, mode: DragState['mode']) => {
    e.stopPropagation();
    const sched = schedule.schedules[task.id];
    if (!sched) return;
    // Best-effort: jsdom dan beberapa lingkungan tidak menyediakan pointer capture.
    // Drag tetap berfungsi karena listener menempel langsung pada elemen.
    const el = e.currentTarget as HTMLElement;
    if (typeof el.setPointerCapture === 'function') {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // pointerId tidak valid di lingkungan ini — abaikan
      }
    }
    setDrag({
      taskId: task.id,
      mode,
      originX: e.clientX,
      origStart: sched.start,
      origEnd: sched.end,
      origDuration: task.duration,
      deltaDays: 0,
    });
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const delta = Math.round((e.clientX - drag.originX) / colW);
    if (delta !== drag.deltaDays) setDrag({ ...drag, deltaDays: delta });
  };

  const preview = useMemo(() => {
    if (!drag || drag.deltaDays === 0) return null;
    const d = drag.deltaDays;
    if (drag.mode === 'move') {
      const raw = addDays(drag.origStart, d);
      const start = isWorkingDay(raw, state.calendar) ? raw : d >= 0 ? nextWorkingDay(raw, state.calendar) : prevWorkingDay(raw, state.calendar);
      return { start, end: durationEndDate(start, drag.origDuration, state.calendar), duration: drag.origDuration };
    }
    if (drag.mode === 'end') {
      const raw = addDays(drag.origEnd, d);
      const end = isWorkingDay(raw, state.calendar) ? raw : d >= 0 ? nextWorkingDay(raw, state.calendar) : prevWorkingDay(raw, state.calendar);
      const duration = end < drag.origStart ? 1 : countWorkdaysInclusive(drag.origStart, end, state.calendar);
      return { start: drag.origStart, end: durationEndDate(drag.origStart, duration, state.calendar), duration };
    }
    // resize kiri
    const raw = addDays(drag.origStart, d);
    let start = isWorkingDay(raw, state.calendar) ? raw : d >= 0 ? nextWorkingDay(raw, state.calendar) : prevWorkingDay(raw, state.calendar);
    if (start > drag.origEnd) start = drag.origEnd;
    const duration = countWorkdaysInclusive(start, drag.origEnd, state.calendar);
    return { start, end: drag.origEnd, duration: Math.max(1, duration) };
  }, [drag, state.calendar]);

  const endDrag = () => {
    if (!drag) return;
    if (preview) {
      if (drag.mode === 'move') updateTask(drag.taskId, { startDate: preview.start });
      else if (drag.mode === 'end') updateTask(drag.taskId, { duration: preview.duration });
      else updateTask(drag.taskId, { startDate: preview.start, duration: preview.duration });
    }
    setDrag(null);
  };

  // ---- Panah dependensi ----
  const links = useMemo(() => {
    const rowIndex = new Map(rows.map((r, i) => [r.task.id, i]));
    const out: { key: string; d: string; lag: number; critical: boolean }[] = [];
    for (const row of rows) {
      const targetIdx = rowIndex.get(row.task.id);
      if (targetIdx === undefined) continue;
      const ts = schedule.schedules[row.task.id];
      if (!ts) continue;
      for (const dep of row.task.dependencies) {
        const ps = schedule.schedules[dep.taskId];
        const sourceIdx = rowIndex.get(dep.taskId);
        if (!ps || sourceIdx === undefined) continue;
        const y1 = sourceIdx * ROW_H + ROW_H / 2;
        const y2 = targetIdx * ROW_H + ROW_H / 2;
        const x1 = dep.type === 'FS' ? xOf(ps.end) + colW : xOf(ps.start);
        const x2 = xOf(ts.start);
        const critical = ps.critical && ts.critical;
        let d: string;
        if (dep.type === 'FS' && x2 - x1 >= 16) {
          const midX = x1 + 10;
          d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2 - 4}`;
        } else {
          const c1 = Math.max(x1 + 24, x1);
          const c2 = Math.min(x2 - 24, x2);
          d = `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2 - 4} ${y2}`;
        }
        out.push({ key: `${dep.taskId}-${row.task.id}`, d, lag: dep.lag, critical });
      }
    }
    return out;
  }, [rows, schedule, colW, range.start]);

  const selectedTask = rows.find((r) => r.task.id === selectedId)?.task ?? null;
  const today = todayISO();
  const todayInRange = today >= range.start && today <= range.end;

  const handleDelete = () => {
    if (!selectedTask) return;
    if (window.confirm(`Hapus tugas "${selectedTask.name}" beserta sub-tugasnya?`)) {
      deleteTask(selectedTask.id);
      setSelectedId(null);
    }
  };

  return (
    <section className="gantt-panel">
      <div className="toolbar">
        <button type="button" className="btn primary" onClick={() => onAddTask(null)}>
          + Tugas baru
        </button>
        <button type="button" className="btn" disabled={!selectedTask} onClick={() => onAddTask(selectedTask?.id ?? null)}>
          + Sub-tugas
        </button>
        <button type="button" className="btn" disabled={!selectedTask} onClick={() => selectedTask && onEditTask(selectedTask)}>
          Edit
        </button>
        <button type="button" className="btn danger" disabled={!selectedTask} onClick={handleDelete}>
          Hapus
        </button>
        <span className="spacer" />
        <input
          className="search"
          placeholder="Cari tugas…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cari tugas"
        />
        <label className={`toggle ${highlightCritical ? 'on' : ''}`}>
          <input type="checkbox" checked={highlightCritical} onChange={onToggleHighlight} />
          Sorot jalur kritis
        </label>
        <div className="zoom">
          <button type="button" className="icon-btn" aria-label="Perkecil" onClick={() => setColW((w) => Math.max(16, w - 6))}>
            −
          </button>
          <button type="button" className="icon-btn" aria-label="Perbesar" onClick={() => setColW((w) => Math.min(72, w + 6))}>
            +
          </button>
        </div>
      </div>

      {schedule.hasCycle && (
        <div className="banner warn">Terdeteksi ketergantungan bersiklus pada data tugas. Jadwal ditampilkan sebisanya.</div>
      )}

      <div className="gantt-scroll" ref={scrollRef} data-testid="gantt-scroll">
        <div className="gantt-inner" style={{ width: LEFT_W + timelineW }}>
          <div className="gantt-header">
            <div className="gantt-head-left">
              <span>Tugas</span>
              <span className="muted">Mulai → Selesai</span>
            </div>
            <div className="gantt-head-right" style={{ width: timelineW }}>
              <div className="months">
                {months.map((m, i) => (
                  <div key={`${m.label}-${i}`} className="month" style={{ width: m.span * colW }}>
                    {m.span * colW > 56 ? m.label : ''}
                  </div>
                ))}
              </div>
              <div className="days">
                {days.map((d) => (
                  <div
                    key={d.date}
                    className={`daycell ${d.dow === 0 || d.dow === 6 ? 'weekend' : ''} ${
                      state.calendar.holidays.some((h) => h.date === d.date) ? 'holiday' : ''
                    } ${d.date === today ? 'today' : ''}`}
                    style={{ width: colW }}
                    title={d.date}
                  >
                    {colW >= 22 && <span className="dl">{dayLetter(d.date).slice(0, 1)}</span>}
                    <span className="dn">{d.date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gantt-body" style={{ height: Math.max(rows.length, 1) * ROW_H }}>
            <svg
              className="gantt-links"
              style={{ left: LEFT_W, width: timelineW, height: Math.max(rows.length, 1) * ROW_H }}
              aria-hidden="true"
            >
              <defs>
                <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
                </marker>
                <marker id="arrow-crit" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#dc2626" />
                </marker>
              </defs>
              {links.map((l) => (
                <path
                  key={l.key}
                  d={l.d}
                  className={`link ${l.critical ? 'crit' : ''}`}
                  fill="none"
                  markerEnd={l.critical ? 'url(#arrow-crit)' : 'url(#arrow)'}
                />
              ))}
            </svg>

            {rows.map((row) => {
              const sched = schedule.schedules[row.task.id];
              if (!sched) return null;
              const isDragging = drag?.taskId === row.task.id;
              const start = isDragging && preview ? preview.start : sched.start;
              const end = isDragging && preview ? preview.end : sched.end;
              const left = xOf(start);
              const width = Math.max(colW * 0.6, xOf(end) + colW - left);
              const children = state.tasks.filter((t) => t.parentId === row.task.id);
              const assignees = state.members.filter((m) => row.task.assigneeIds.includes(m.id));
              return (
                <div
                  key={row.task.id}
                  className={`gantt-row ${selectedId === row.task.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(row.task.id)}
                  onDoubleClick={() => onEditTask(row.task)}
                >
                  <div className="gantt-row-left" style={{ paddingLeft: 10 + row.depth * 18 }}>
                    {children.length > 0 ? (
                      <button
                        type="button"
                        className="chevron"
                        aria-label={row.task.collapsed ? 'Buka' : 'Tutup'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(row.task.id);
                        }}
                      >
                        {row.task.collapsed ? '▸' : '▾'}
                      </button>
                    ) : (
                      <span className="chevron empty" />
                    )}
                    <span className="dot" style={{ background: row.task.color }} />
                    <span className="task-name" title={row.task.description || row.task.name}>
                      {row.task.name}
                    </span>
                    <span className="row-meta">
                      {row.task.assigneeIds.length > 0 && (
                        <span className="avatars" title={assignees.map((a) => a.name).join(', ')}>
                          {assignees.slice(0, 3).map((a) => (
                            <span key={a.id} className="avatar">
                              {a.name.slice(0, 1).toUpperCase()}
                            </span>
                          ))}
                        </span>
                      )}
                      <span className={`prio p-${row.task.priority.toLowerCase()}`}>{PRIORITY_LABELS[row.task.priority]}</span>
                      <span className="dates">
                        {sched.start.slice(8)}/{sched.start.slice(5, 7)} → {sched.end.slice(8)}/{sched.end.slice(5, 7)}
                      </span>
                    </span>
                  </div>
                  <div className="gantt-row-right" style={{ width: timelineW }}>
                    <div className="track">
                      {days.map((d) => {
                        const holiday = state.calendar.holidays.some((h) => h.date === d.date);
                        return (
                          <span
                            key={d.date}
                            className={`cell ${!isWorkingDay(d.date, state.calendar) ? 'nonwork' : ''} ${holiday ? 'holiday' : ''}`}
                            style={{ width: colW }}
                          />
                        );
                      })}
                    </div>
                    <div
                      className={`bar ${highlightCritical && sched.critical ? 'critical' : ''} ${isDragging ? 'dragging' : ''}`}
                      style={{ left, width, background: row.task.color }}
                      title={`${row.task.name}\n${formatShort(sched.start)} → ${formatShort(sched.end)} (${row.task.duration} hari kerja)`}
                      onPointerDown={(e) => startDrag(e, row.task, 'move')}
                      onPointerMove={onDragMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onEditTask(row.task);
                      }}
                    >
                      <span
                        className="handle left"
                        onPointerDown={(e) => startDrag(e, row.task, 'start')}
                        onPointerMove={onDragMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      />
                      <span className="bar-label">{row.task.name}</span>
                      <span
                        className="progress"
                        style={{ width: `${Math.min(100, Math.max(0, row.task.progress))}%` }}
                      />
                      <span
                        className="handle right"
                        onPointerDown={(e) => startDrag(e, row.task, 'end')}
                        onPointerMove={onDragMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && <p className="empty-state">Belum ada tugas. Klik “+ Tugas baru”.</p>}
          </div>
        </div>
      </div>

      <div className="legend">
        <span className="legend-item">
          <span className="swatch-inline crit" /> Jalur kritis
        </span>
        <span className="legend-item">
          <span className="swatch-inline nonwork" /> Akhir pekan / libur
        </span>
        <span className="legend-item">Seret bar untuk memindah • Tarik tepi bar untuk ubah durasi • Klik ganda untuk edit</span>
        {todayInRange && <span className="legend-item">Hari ini: {formatShort(today)}</span>}
      </div>
    </section>
  );
}
