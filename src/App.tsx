import { useState } from 'react';
import type { Task } from './types';
import { StoreProvider, useStore } from './state/store';
import GanttChart from './components/GanttChart';
import TaskModal from './components/TaskModal';
import ResourcePanel from './components/ResourcePanel';
import CalendarPanel from './components/CalendarPanel';
import AnalysisPanel from './components/AnalysisPanel';
import { formatShort } from './lib/calendar';

type Tab = 'gantt' | 'resources' | 'calendar' | 'analysis';

const TABS: { id: Tab; label: string }[] = [
  { id: 'gantt', label: 'Gantt Chart' },
  { id: 'resources', label: 'Sumber Daya' },
  { id: 'calendar', label: 'Kalender' },
  { id: 'analysis', label: 'Analisis' },
];

interface ModalState {
  open: boolean;
  task: Task | null;
  parentId: string | null;
}

function Shell() {
  const { state, schedule, setProjectName, resetData } = useStore();
  const [tab, setTab] = useState<Tab>('gantt');
  const [modal, setModal] = useState<ModalState>({ open: false, task: null, parentId: null });
  const [highlightCritical, setHighlightCritical] = useState(true);

  const openEdit = (task: Task) => setModal({ open: true, task, parentId: null });
  const openAdd = (parentId: string | null) => setModal({ open: true, task: null, parentId });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▦</span>
          <div>
            <input
              className="project-name"
              value={state.projectName}
              onChange={(e) => setProjectName(e.target.value)}
              aria-label="Nama proyek"
            />
            <div className="project-meta">
              {state.tasks.length} tugas • {state.members.length} anggota • {formatShort(schedule.projectStart)} →{' '}
              {formatShort(schedule.projectEnd)} • {schedule.projectDuration} hari kerja
            </div>
          </div>
        </div>
        <nav className="tabs" aria-label="Navigasi utama">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (window.confirm('Kembalikan seluruh data ke data contoh (seed)?')) resetData();
          }}
        >
          Reset data contoh
        </button>
      </header>

      <main className="content">
        {tab === 'gantt' && (
          <GanttChart
            onEditTask={openEdit}
            onAddTask={openAdd}
            highlightCritical={highlightCritical}
            onToggleHighlight={() => setHighlightCritical((v) => !v)}
          />
        )}
        {tab === 'resources' && <ResourcePanel />}
        {tab === 'calendar' && <CalendarPanel />}
        {tab === 'analysis' && <AnalysisPanel />}
      </main>

      <TaskModal open={modal.open} task={modal.task} defaultParentId={modal.parentId} onClose={closeModal} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
