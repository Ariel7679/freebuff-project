import { useState } from 'react';
import { formatIDR } from '../lib/calendar';
import { useStore } from '../state/store';

interface Form {
  name: string;
  email: string;
  role: string;
  salary: string;
}

const EMPTY: Form = { name: '', email: '', role: '', salary: '' };

export default function ResourcePanel() {
  const { state, schedule, addMember, updateMember, deleteMember } = useStore();
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY);

  const submit = () => {
    if (!form.name.trim()) {
      setError('Nama anggota wajib diisi.');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Format email tidak valid.');
      return;
    }
    setError('');
    addMember({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim() || 'Anggota Tim',
      salary: Math.max(0, Math.round(Number(form.salary) || 0)),
    });
    setForm(EMPTY);
  };

  const startEdit = (id: string) => {
    const m = state.members.find((x) => x.id === id);
    if (!m) return;
    setEditingId(id);
    setEditForm({ name: m.name, email: m.email, role: m.role, salary: String(m.salary) });
  };

  const saveEdit = (id: string) => {
    if (!editForm.name.trim()) return;
    updateMember(id, {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      role: editForm.role.trim(),
      salary: Math.max(0, Math.round(Number(editForm.salary) || 0)),
    });
    setEditingId(null);
  };

  const allocationOf = (memberId: string) => {
    const tasks = state.tasks.filter((t) => t.assigneeIds.includes(memberId));
    const days = tasks.reduce((sum, t) => sum + (schedule.schedules[t.id] ? t.duration : 0), 0);
    return { tasks, days };
  };

  const totalSalary = state.members.reduce((s, m) => s + m.salary, 0);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Sumber Daya (Anggota Tim)</h2>
        <p className="muted">Daftarkan anggota, lalu alokasikan ke tugas lewat dialog edit tugas.</p>
      </header>

      <div className="card">
        <h3>Tambah anggota</h3>
        <div className="form-grid">
          <label className="field">
            <span>Nama *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="nama@perusahaan.com"
            />
          </label>
          <label className="field">
            <span>Peran</span>
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Contoh: Backend Developer" />
          </label>
          <label className="field">
            <span>Gaji / bulan (Rp)</span>
            <input
              type="number"
              min={0}
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
              placeholder="12000000"
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          + Tambah anggota
        </button>
      </div>

      <div className="card">
        <h3>Daftar anggota ({state.members.length})</h3>
        {state.members.length === 0 && <p className="muted">Belum ada anggota terdaftar.</p>}
        {state.members.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th className="num">Gaji / bulan</th>
                  <th>Alokasi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.members.map((m) => {
                  const alloc = allocationOf(m.id);
                  const editing = editingId === m.id;
                  return (
                    <tr key={m.id}>
                      <td>
                        {editing ? (
                          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        ) : (
                          <strong>{m.name}</strong>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                        ) : (
                          m.email || '—'
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} />
                        ) : (
                          m.role
                        )}
                      </td>
                      <td className="num">
                        {editing ? (
                          <input
                            type="number"
                            min={0}
                            value={editForm.salary}
                            onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                          />
                        ) : (
                          formatIDR(m.salary)
                        )}
                      </td>
                      <td>
                        <span className="muted">
                          {alloc.tasks.length} tugas • {alloc.days} hari kerja
                        </span>
                        <div className="tag-wrap">
                          {alloc.tasks.map((t) => (
                            <span key={t.id} className="tag" style={{ borderColor: t.color }}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="actions">
                        {editing ? (
                          <>
                            <button type="button" className="btn small primary" onClick={() => saveEdit(m.id)}>
                              Simpan
                            </button>
                            <button type="button" className="btn small ghost" onClick={() => setEditingId(null)}>
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn small" onClick={() => startEdit(m.id)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn small danger"
                              onClick={() => {
                                if (window.confirm(`Hapus anggota ${m.name}?`)) deleteMember(m.id);
                              }}
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total gaji bulanan</td>
                  <td className="num">{formatIDR(totalSalary)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
