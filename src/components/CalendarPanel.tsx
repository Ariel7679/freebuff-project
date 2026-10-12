import { useMemo, useState } from 'react';
import { addDays, countWorkdaysInclusive, formatMonthYear, isWorkingDay, pad2, todayISO } from '../lib/calendar';
import { useStore } from '../state/store';

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function CalendarPanel() {
  const { state, schedule, addHoliday, removeHoliday, toggleWeekendDay } = useStore();
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const submit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pilih tanggal libur terlebih dahulu.');
      return;
    }
    if (!name.trim()) {
      setError('Nama hari libur wajib diisi.');
      return;
    }
    if (state.calendar.holidays.some((h) => h.date === date)) {
      setError('Tanggal tersebut sudah terdaftar sebagai hari libur.');
      return;
    }
    setError('');
    addHoliday(date, name);
    setName('');
  };

  const projectWorkdays = useMemo(() => {
    if (!schedule.projectStart || !schedule.projectEnd) return 0;
    return countWorkdaysInclusive(schedule.projectStart, schedule.projectEnd, state.calendar);
  }, [schedule.projectStart, schedule.projectEnd, state.calendar]);

  const calendarCells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${cursor.year}-${pad2(cursor.month + 1)}-${pad2(d)}`);
    return cells;
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  const today = todayISO();

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Kalender Proyek</h2>
        <p className="muted">Durasi selalu dihitung dalam hari kerja — akhir pekan dan hari libur dilewati.</p>
      </header>

      <div className="panel-grid">
        <div className="card">
          <h3>Hari akhir pekan</h3>
          <div className="weekday-toggles">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const on = state.calendar.weekendDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() => toggleWeekendDay(d)}
                  aria-pressed={on}
                >
                  {DAY_LABELS[d]}
                </button>
              );
            })}
          </div>
          <p className="muted">
            Aktif: {state.calendar.weekendDays.length === 0 ? 'tidak ada (semua hari kerja)' : state.calendar.weekendDays.map((d) => DAY_LABELS[d]).join(', ')}
          </p>

          <div className="stats">
            <div className="stat">
              <span className="stat-val">{state.calendar.holidays.length}</span>
              <span className="stat-label">Hari libur khusus</span>
            </div>
            <div className="stat">
              <span className="stat-val">{projectWorkdays}</span>
              <span className="stat-label">Hari kerja proyek</span>
            </div>
            <div className="stat">
              <span className="stat-val">{schedule.projectDuration}</span>
              <span className="stat-label">Durasi jadwal (hari kerja)</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Tambah hari libur khusus</h3>
          <div className="form-grid">
            <label className="field">
              <span>Tanggal</span>
              <input type="date" value={date} min="2000-01-01" onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Nama libur</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Hari Libur Nasional" />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn primary" onClick={submit}>
            + Tambah libur
          </button>

          <ul className="holiday-list">
            {state.calendar.holidays.length === 0 && <li className="muted">Belum ada hari libur khusus.</li>}
            {[...state.calendar.holidays]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((h) => (
                <li key={h.id}>
                  <span className="holiday-date">{h.date}</span>
                  <span>{h.name}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Hapus libur ${h.name}`}
                    onClick={() => removeHoliday(h.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="cal-head">
          <button type="button" className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => shiftMonth(-1)}>
            ‹
          </button>
          <h3>{formatMonthYear(`${cursor.year}-${pad2(cursor.month + 1)}-01`)}</h3>
          <button type="button" className="icon-btn" aria-label="Bulan berikutnya" onClick={() => shiftMonth(1)}>
            ›
          </button>
        </div>
        <div className="mini-cal">
          {DAY_LABELS.map((d) => (
            <span key={d} className="mini-dow">
              {d}
            </span>
          ))}
          {calendarCells.map((iso, i) => {
            if (!iso) return <span key={`pad-${i}`} className="mini-day empty" />;
            const working = isWorkingDay(iso, state.calendar);
            const holiday = state.calendar.holidays.find((h) => h.date === iso);
            return (
              <span
                key={iso}
                className={`mini-day ${working ? 'work' : 'off'} ${iso === today ? 'today' : ''}`}
                title={holiday ? `${iso} — ${holiday.name}` : iso}
              >
                {Number(iso.slice(8))}
              </span>
            );
          })}
        </div>
        <p className="muted">
          Rentang jadwal: {schedule.projectStart} s/d {schedule.projectEnd} • hari ini {addDays(today, 0)}
        </p>
      </div>
    </section>
  );
}
