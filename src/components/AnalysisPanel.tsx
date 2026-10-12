import { useMemo } from 'react';
import { computePert } from '../lib/pert';
import { formatShort } from '../lib/calendar';
import { useStore } from '../state/store';

const NODE_W = 168;
const NODE_H = 66;
const GAP_X = 78;
const GAP_Y = 22;

export default function AnalysisPanel() {
  const { state, schedule } = useStore();
  const pert = useMemo(() => computePert(state.tasks, state.calendar), [state.tasks, state.calendar]);

  const criticalTasks = schedule.criticalPathIds
    .map((id) => state.tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const maxLevel = pert.nodes.reduce((m, n) => Math.max(m, n.level), 0);
  const rowsPerLevel = useMemo(() => {
    const map = new Map<number, number>();
    for (const n of pert.nodes) map.set(n.level, (map.get(n.level) ?? 0) + 1);
    return map;
  }, [pert.nodes]);
  const maxRows = Math.max(1, ...rowsPerLevel.values());
  const svgW = (maxLevel + 1) * (NODE_W + GAP_X) + 40;
  const svgH = maxRows * (NODE_H + GAP_Y) + 40;

  const nodePos = (level: number, row: number) => ({
    x: 24 + level * (NODE_W + GAP_X),
    y: 24 + row * (NODE_H + GAP_Y),
  });

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Analisis Proyek</h2>
        <p className="muted">Jalur kritis (CPM) dan diagram PERT berdasarkan durasi hari kerja.</p>
      </header>

      <div className="stats wide">
        <div className="stat">
          <span className="stat-val">{schedule.projectDuration}</span>
          <span className="stat-label">Durasi proyek (hari kerja)</span>
        </div>
        <div className="stat">
          <span className="stat-val">{formatShort(schedule.projectStart)}</span>
          <span className="stat-label">Mulai proyek</span>
        </div>
        <div className="stat">
          <span className="stat-val">{formatShort(schedule.projectEnd)}</span>
          <span className="stat-label">Selesai proyek</span>
        </div>
        <div className="stat">
          <span className="stat-val">{criticalTasks.length}</span>
          <span className="stat-label">Tugas jalur kritis</span>
        </div>
        <div className="stat">
          <span className="stat-val">{pert.expectedDuration.toFixed(1)}</span>
          <span className="stat-label">Durasi ekspektasi PERT</span>
        </div>
        <div className="stat">
          <span className="stat-val">±{pert.stddev.toFixed(2)}</span>
          <span className="stat-label">Deviasi standar jalur kritis</span>
        </div>
      </div>

      <div className="panel-grid">
        <div className="card">
          <h3>Jalur Kritis (Critical Path)</h3>
          <p className="muted">Tugas dengan slack = 0. Keterlambatannya langsung menunda akhir proyek.</p>
          {criticalTasks.length === 0 ? (
            <p className="muted">Tidak ada jalur kritis (cek ketergantungan tugas).</p>
          ) : (
            <ol className="critical-list">
              {criticalTasks.map((t) => {
                const s = schedule.schedules[t.id];
                return (
                  <li key={t.id}>
                    <span className="dot" style={{ background: t.color }} />
                    <div>
                      <strong>{t.name}</strong>
                      <div className="muted">
                        {formatShort(s.start)} → {formatShort(s.end)} • {t.duration} hari kerja • slack {s.slack}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <h3 className="mt">Estimasi PERT per tugas</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tugas</th>
                  <th className="num">O</th>
                  <th className="num">M</th>
                  <th className="num">P</th>
                  <th className="num">E=(O+4M+P)/6</th>
                  <th className="num">Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pert.nodes.map((n) => (
                  <tr key={n.id} className={n.critical ? 'row-critical' : ''}>
                    <td>{n.name}</td>
                    <td className="num">{n.optimistic}</td>
                    <td className="num">{n.mostLikely}</td>
                    <td className="num">{n.pessimistic}</td>
                    <td className="num">{n.expected.toFixed(2)}</td>
                    <td className="num">{n.variance.toFixed(2)}</td>
                    <td>{n.critical ? <span className="badge crit">Kritis</span> : <span className="badge">Slack {n.slack.toFixed(1)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Diagram PERT</h3>
          <p className="muted">Kotak merah = jalur kritis. Panah FS/SS dengan jeda (lag) hari kerja.</p>
          <div className="pert-scroll">
            <svg width={svgW} height={svgH} role="img" aria-label="Diagram PERT">
              <defs>
                <marker id="pert-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
                </marker>
                <marker id="pert-arrow-crit" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#dc2626" />
                </marker>
              </defs>
              {pert.edges.map((e) => {
                const from = pert.nodeById[e.from];
                const to = pert.nodeById[e.to];
                if (!from || !to) return null;
                const a = nodePos(from.level, from.row);
                const b = nodePos(to.level, to.row);
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const midX = Math.max(x1 + 20, (x1 + x2) / 2);
                const d =
                  x2 - x1 >= 30
                    ? `M ${x1} ${y1} H ${midX} V ${y2} H ${x2 - 5}`
                    : `M ${x1} ${y1} C ${x1 + 30} ${y1}, ${x2 - 30} ${y2}, ${x2 - 5} ${y2}`;
                return (
                  <path
                    key={`${e.from}-${e.to}`}
                    d={d}
                    fill="none"
                    stroke={e.critical ? '#dc2626' : '#64748b'}
                    strokeWidth={e.critical ? 2 : 1.4}
                    strokeDasharray={e.type === 'SS' ? '5 3' : undefined}
                    markerEnd={e.critical ? 'url(#pert-arrow-crit)' : 'url(#pert-arrow)'}
                  />
                );
              })}
              {pert.nodes.map((n) => {
                const p = nodePos(n.level, n.row);
                return (
                  <g key={n.id}>
                    <rect
                      x={p.x}
                      y={p.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={9}
                      fill={n.critical ? '#fef2f2' : '#ffffff'}
                      stroke={n.critical ? '#dc2626' : '#cbd5e1'}
                      strokeWidth={n.critical ? 2 : 1.2}
                    />
                    <text x={p.x + 10} y={p.y + 20} fontSize={12.5} fontWeight={600} fill="#0f172a">
                      {n.name.length > 21 ? `${n.name.slice(0, 20)}…` : n.name}
                    </text>
                    <text x={p.x + 10} y={p.y + 38} fontSize={11} fill="#475569">
                      E = {n.expected.toFixed(2)} hari
                    </text>
                    <text x={p.x + 10} y={p.y + 54} fontSize={11} fill="#475569">
                      O {n.optimistic} / M {n.mostLikely} / P {n.pessimistic}
                      {n.critical ? ' • KRITIS' : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
