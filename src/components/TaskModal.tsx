import { useEffect, useMemo, useState } from 'react';
import type { Dependency, LinkType, Priority, Task } from '../types';
import { COLOR_SWATCHES, PRIORITY_LABELS } from '../types';
import { useStore } from '../state/store';

interface Props {
  task: Task | null;
  defaultParentId?: string | null;
  open: boolean;
  onClose: () => void;
}

interface DepRow {
  taskId: string;
  type: LinkType;
  lag: string;
}

function descendantsOf(tasks: Task[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) {
      if (t.parentId && out.has(t.parentId) && !out.has(t.id)) {
        out.add(t.id);
        grew = true;
      }
    }
  }
  return out;
}

export default function TaskModal({ task, defaultParentId, open, onClose }: Props) {
  const { state, addTask, updateTask } = useStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2026-10-12');
  const [duration, setDuration] = useState('3');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [parentId, setParentId] = useState<string>('');
  const [progress, setProgress] = useState('0');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [deps, setDeps] = useState<DepRow[]>([]);
  const [optimistic, setOptimistic] = useState('1');
  const [mostLikely, setMostLikely] = useState('3');
  const [pessimistic, setPessimistic] = useState('5');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (task) {
      setName(task.name);
      setDescription(task.description);
      setStartDate(task.startDate);
      setDuration(String(task.duration));
      setPriority(task.priority);
      setColor(task.color);
      setParentId(task.parentId ?? '');
      setProgress(String(task.progress));
      setAssignees([...task.assigneeIds]);
      setDeps(task.dependencies.map((d) => ({ taskId: d.taskId, type: d.type, lag: String(d.lag) })));
      setOptimistic(String(task.pert.optimistic));
      setMostLikely(String(task.pert.mostLikely));
      setPessimistic(String(task.pert.pessimistic));
    } else {
      setName('');
      setDescription('');
      setStartDate(state.startDate);
      setDuration('3');
      setPriority('Medium');
      setColor(COLOR_SWATCHES[state.tasks.length % COLOR_SWATCHES.length]);
      setParentId(defaultParentId ?? '');
      setProgress('0');
      setAssignees([]);
      setDeps([]);
      setOptimistic('1');
      setMostLikely('3');
      setPessimistic('5');
    }
  }, [open, task, defaultParentId, state.startDate, state.tasks.length]);

  const blockedParents = useMemo(() => (task ? descendantsOf(state.tasks, task.id) : new Set<string>()), [state.tasks, task]);
  const depCandidates = state.tasks.filter((t) => t.id !== task?.id);

  if (!open) return null;

  const toggleAssignee = (id: string) => {
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Nama tugas wajib diisi.');
      return;
    }
    const dur = Math.max(1, Math.round(Number(duration) || 1));
    const numericStart = startDate || state.startDate;

    const seen = new Set<string>();
    const dependencies: Dependency[] = [];
    for (const row of deps) {
      if (!row.taskId || row.taskId === task?.id || seen.has(row.taskId)) continue;
      seen.add(row.taskId);
      dependencies.push({ taskId: row.taskId, type: row.type, lag: Math.max(0, Math.round(Number(row.lag) || 0)) });
    }

    const patch = {
      name: trimmed,
      description: description.trim(),
      startDate: numericStart,
      duration: dur,
      priority,
      color,
      parentId: parentId || null,
      progress: Math.min(100, Math.max(0, Math.round(Number(progress) || 0))),
      assigneeIds: assignees,
      dependencies,
      pert: {
        optimistic: Math.max(0, Number(optimistic) || dur),
        mostLikely: Math.max(0, Number(mostLikely) || dur),
        pessimistic: Math.max(0, Number(pessimistic) || dur),
      },
    };

    if (task) {
      updateTask(task.id, patch);
    } else {
      // addTask mengembalikan id tugas baru; lengkapi field lain lewat updateTask
      const createdId = addTask({
        name: trimmed,
        description: patch.description,
        startDate: numericStart,
        duration: dur,
        priority,
        color,
        parentId: parentId || null,
      });
      updateTask(createdId, patch);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={task ? 'Edit tugas' : 'Tugas baru'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{task ? 'Edit Tugas' : 'Tugas Baru'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>Nama tugas *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Desain Wireframe" autoFocus />
          </label>

          <label className="field">
            <span>Deskripsi</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Deskripsi singkat" />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Tanggal mulai</span>
              <input type="date" value={startDate} min="2000-01-01" onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Durasi (hari kerja)</span>
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label className="field">
              <span>Progres (%)</span>
              <input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Prioritas</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option value="Low">{PRIORITY_LABELS.Low}</option>
                <option value="Medium">{PRIORITY_LABELS.Medium}</option>
                <option value="High">{PRIORITY_LABELS.High}</option>
              </select>
            </label>
            <label className="field">
              <span>Induk (sub-tugas)</span>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">— Tugas utama —</option>
                {state.tasks
                  .filter((t) => !blockedParents.has(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="field">
              <span>Warna indikator</span>
              <div className="swatches">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    aria-label={`Pilih warna ${c}`}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <fieldset className="field-block">
            <legend>Predecessor (hubungan antar tugas)</legend>
            {deps.length === 0 && <p className="muted">Belum ada ketergantungan. Tugas ini mandiri.</p>}
            {deps.map((row, i) => (
              <div className="dep-row" key={`${row.taskId}-${i}`}>
                <select
                  value={row.taskId}
                  onChange={(e) => setDeps((prev) => prev.map((d, j) => (j === i ? { ...d, taskId: e.target.value } : d)))}
                  aria-label="Predecessor"
                >
                  <option value="">— Pilih tugas —</option>
                  {depCandidates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={row.type}
                  onChange={(e) => setDeps((prev) => prev.map((d, j) => (j === i ? { ...d, type: e.target.value as LinkType } : d)))}
                  aria-label="Tipe hubungan"
                >
                  <option value="FS">Finish-to-Start (FS)</option>
                  <option value="SS">Start-to-Start (SS)</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={row.lag}
                  aria-label="Jeda hari kerja"
                  title="Jeda (lag) dalam hari kerja"
                  onChange={(e) => setDeps((prev) => prev.map((d, j) => (j === i ? { ...d, lag: e.target.value } : d)))}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Hapus dependensi"
                  onClick={() => setDeps((prev) => prev.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost"
              onClick={() => setDeps((prev) => [...prev, { taskId: depCandidates[0]?.id ?? '', type: 'FS', lag: '0' }])}
            >
              + Tambah predecessor
            </button>
          </fieldset>

          <fieldset className="field-block">
            <legend>Alokasi anggota tim</legend>
            <div className="chip-wrap">
              {state.members.map((m) => (
                <label key={m.id} className={`chip ${assignees.includes(m.id) ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={assignees.includes(m.id)}
                    onChange={() => toggleAssignee(m.id)}
                  />
                  {m.name}
                  <span className="chip-role">{m.role}</span>
                </label>
              ))}
              {state.members.length === 0 && <p className="muted">Belum ada anggota. Tambahkan di tab Sumber Daya.</p>}
            </div>
          </fieldset>

          <fieldset className="field-block">
            <legend>Estimasi PERT (hari kerja)</legend>
            <div className="field-row three">
              <label className="field">
                <span>Optimis (O)</span>
                <input type="number" min={0} value={optimistic} onChange={(e) => setOptimistic(e.target.value)} />
              </label>
              <label className="field">
                <span>Paling mungkin (M)</span>
                <input type="number" min={0} value={mostLikely} onChange={(e) => setMostLikely(e.target.value)} />
              </label>
              <label className="field">
                <span>Pesimis (P)</span>
                <input type="number" min={0} value={pessimistic} onChange={(e) => setPessimistic(e.target.value)} />
              </label>
            </div>
          </fieldset>

          {error && <p className="error">{error}</p>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn primary" onClick={submit}>
            {task ? 'Simpan perubahan' : 'Tambah tugas'}
          </button>
        </div>
      </div>
    </div>
  );
}
