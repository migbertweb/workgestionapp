import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Clock, Play, Pause } from 'lucide-react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import FileUpload from '../components/FileUpload.jsx';
import { downloadBudgetPDF } from '../pdf.js';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

const COLUMNS = [
  { id: 'todo', label: 'Por Hacer', color: 'var(--muted)' },
  { id: 'progress', label: 'En Progreso', color: 'var(--accent)' },
  { id: 'review', label: 'Revisión', color: 'var(--warning)' },
  { id: 'done', label: 'Completado', color: 'var(--success)' },
];

function TaskCard({ task, onDelete, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(task.id) });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onEdit(task)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className={`priority-dot priority-${task.priority || 'medium'}`} />
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{task.title}</span>
      </div>
      {task.description && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{task.description}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {task.estimated_hours > 0 && <span>{task.estimated_hours}h</span>}
          {task.estimated_hours > 0 && task.rate > 0 && ' · '}
          {task.rate > 0 && <span>{money(task.rate)}/h</span>}
          {task.category && <span> · {task.category}</span>}
        </div>
        <button
          className="btn btn-danger btn-sm"
          style={{ padding: '2px 6px', fontSize: 11 }}
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function Column({ col, tasks, onDelete, onEdit }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="kanban-col" ref={setNodeRef} style={isOver ? { borderColor: 'var(--accent)' } : {}}>
      <div className="kanban-col-header">
        <span style={{ color: col.color }}>{col.label}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tasks.length}</span>
      </div>
      <div className="kanban-col-body">
        {tasks.map(t => <TaskCard key={t.id} task={t} onDelete={onDelete} onEdit={onEdit} />)}
        {tasks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 12, opacity: 0.5 }}>Soltar aquí…</div>}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [stages, setStages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [assumptions, setAssumptions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [tab, setTab] = useState('overview');
  const [timer, setTimer] = useState({ active: false, startTime: null, elapsed: 0 });
  const [newAssumption, setNewAssumption] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    const [p, s, t, li, te, as] = await Promise.all([
      api.getProject(id), api.getStages(id), api.getTasks(id),
      api.getLineItems(id), api.getTimeEntries(id), api.getAssumptions(id)
    ]);
    setProject(p);
    setStages(s);
    setTasks(t);
    setLineItems(li);
    setTimeEntries(te);
    setAssumptions(as);
  };

  useEffect(() => { load(); }, [id]);

  // Timer logic
  useEffect(() => {
    if (!timer.active) return;
    const interval = setInterval(() => {
      setTimer(t => ({ ...t, elapsed: (Date.now() - t.startTime) / 1000 / 3600 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.active]);

  const startTimer = () => setTimer({ active: true, startTime: Date.now(), elapsed: 0 });

  const stopTimer = async () => {
    const hours = timer.elapsed;
    await api.createTimeEntry({ project_id: Number(id), hours, description: 'Timer session', started_at: new Date(timer.startTime).toISOString(), ended_at: new Date().toISOString() });
    setTimer({ active: false, startTime: null, elapsed: 0 });
    load();
  };

  const onDragEnd = async (e) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id;
    const taskId = Number(active.id);
    await api.updateTask(taskId, { status: newStatus });
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleCreateTask = async (data) => {
    await api.createTask({ ...data, project_id: Number(id) });
    setShowTaskModal(false);
    load();
  };

  const handleEditTask = async (data) => {
    await api.updateTask(editTask.id, data);
    setEditTask(null);
    load();
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('¿Eliminar tarea?')) return;
    await api.deleteTask(taskId);
    load();
  };

  const handleDeleteTime = async (teId) => {
    await api.deleteTimeEntry(teId);
    load();
  };

  const handleAddAssumption = async (e) => {
    e.preventDefault();
    if (!newAssumption.trim()) return;
    await api.createAssumption({ project_id: Number(id), text: newAssumption });
    setNewAssumption('');
    load();
  };

  const handleDeleteAssumption = async (aId) => {
    await api.deleteAssumption(aId);
    load();
  };

  const handleStageStatus = async (stageId, newStatus) => {
    await api.updateStage(stageId, { status: newStatus });
    load();
  };

  if (!project) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;

  const bufferAmount = (project.budget || 0) * (project.buffer_percent || 20) / 100;
  const total = (project.budget || 0) + bufferAmount;
  const totalCost = lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const totalHours = timeEntries.reduce((s, t) => s + (t.hours || 0), 0);
  const margin = total - totalCost;
  const activeTask = activeId ? tasks.find(t => String(t.id) === activeId) : null;

  const tabs = [
    { id: 'overview', label: 'Resumen' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'tasks', label: 'Tasklist' },
    { id: 'budget', label: 'Presupuesto' },
    { id: 'time', label: 'Tiempo' },
  ];

  return (
    <div>
      <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 14, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Volver a proyectos
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>{project.name}</h1>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            {project.client || 'Sin cliente'} · <span className={`badge badge-${project.status}`}>{project.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {timer.active ? (
            <>
              <div style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>
                {timer.elapsed.toFixed(4)}h
              </div>
              <button className="btn btn-danger" onClick={stopTimer}>
                <Pause size={16} /> Stop
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={startTimer}>
              <Play size={16} /> Iniciar Timer
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>
            <Plus size={18} /> Nueva Tarea
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Presupuesto</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{money(project.budget)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">+ Buffer ({project.buffer_percent}%)</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{money(bufferAmount)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value" style={{ fontSize: 22, color: 'var(--success)' }}>{money(total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Costo Real</div>
          <div className="stat-value" style={{ fontSize: 22, color: 'var(--danger)' }}>{money(totalCost)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Horas</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{totalHours.toFixed(1)}h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Margen</div>
          <div className="stat-value" style={{ fontSize: 22, color: margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(margin)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--muted)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Etapas del Proyecto</h3>
            {stages.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1 }}>{s.name}</span>
                <select
                  value={s.status}
                  onChange={(e) => handleStageStatus(s.id, e.target.value)}
                  className="input"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                >
                  <option value="todo">todo</option>
                  <option value="progress">progress</option>
                  <option value="review">review</option>
                  <option value="done">done</option>
                </select>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Asunciones</h3>
            <form onSubmit={handleAddAssumption} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="input" placeholder="Nueva asunción…" value={newAssumption} onChange={e => setNewAssumption(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /></button>
            </form>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {assumptions.map(a => (
                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13 }}>{a.text}</span>
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px' }} onClick={() => handleDeleteAssumption(a.id)}>
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
              {assumptions.length === 0 && <li style={{ color: 'var(--muted)', fontSize: 13 }}>Sin asunciones</li>}
            </ul>
          </div>
        </div>
        <ActivityFeed projectId={Number(id)} />
        <FileUpload projectId={Number(id)} />
        </>
      )}

      {/* Kanban */}
      {tab === 'kanban' && (
        <div>
          <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id)} onDragEnd={onDragEnd}>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
              {COLUMNS.map(col => (
                <Column key={col.id} col={col} tasks={tasks.filter(t => t.status === col.id)} onDelete={handleDeleteTask} onEdit={setEditTask} />
              ))}
            </div>
            <DragOverlay>
              {activeTask ? (
                <div className="task-card dragging" style={{ opacity: 0.8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{activeTask.title}</div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Tasklist */}
      {tab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/api/projects/${id}/tasks/export/csv`)}>📥 CSV</button>
          </div>
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Prioridad</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Título</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Estado</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Horas</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Tarifa</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Total</th>
                <th style={{ padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onDoubleClick={() => setEditTask(t)}>
                  <td style={{ padding: '8px' }}><span className={`priority-dot priority-${t.priority || 'medium'}`} /></td>
                  <td style={{ padding: '8px' }}>{t.title}</td>
                  <td style={{ padding: '8px' }}><span className={`badge badge-${t.status || 'todo'}`}>{t.status || 'todo'}</span></td>
                  <td style={{ padding: '8px' }}>{t.estimated_hours || 0}h</td>
                  <td style={{ padding: '8px' }}>{money(t.rate)}/h</td>
                  <td style={{ padding: '8px' }}>{money((t.estimated_hours || 0) * (t.rate || 0))}</td>
                  <td style={{ padding: '8px' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t.id)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin tareas. Crea una nueva.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Budget tab */}
      {tab === 'budget' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => {
              try {
                downloadBudgetPDF(project, lineItems, stages, bufferAmount);
              } catch (e) {
                console.error('PDF error:', e);
                alert('Error generando PDF: ' + e.message);
              }
            }}>
              📄 Descargar PDF
            </button>
          </div>
        <div className="card">
          <BudgetTab projectId={Number(id)} lineItems={lineItems} stages={stages} onReload={load} />
        </div>
        </div>
      )}

      {/* Time tab */}
      {tab === 'time' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Entradas de Tiempo</h3>
          <ManualTimeEntry projectId={Number(id)} onAdded={load} />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Fecha</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Descripción</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Horas</th>
                <th style={{ padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.map(te => (
                <tr key={te.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', fontSize: 13 }}>{new Date(te.started_at).toLocaleDateString()}</td>
                  <td style={{ padding: '8px', fontSize: 13 }}>{te.description || '—'}</td>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{te.hours.toFixed(2)}h</td>
                  <td style={{ padding: '8px' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTime(te.id)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {timeEntries.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin registros. Usa el timer o agrega manualmente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Task modals */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="Nueva Tarea">
        <TaskForm onSubmit={handleCreateTask} onCancel={() => setShowTaskModal(false)} stages={stages} />
      </Modal>
      <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Editar Tarea">
        <TaskForm initial={editTask} onSubmit={handleEditTask} onCancel={() => setEditTask(null)} stages={stages} />
      </Modal>
    </div>
  );
}

function TaskForm({ initial, onSubmit, onCancel, stages }) {
  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium',
    estimated_hours: 0, rate: 0, category: 'dev', stage_id: ''
  });

  useEffect(() => {
    if (initial) setForm({
      title: initial.title || '',
      description: initial.description || '',
      status: initial.status || 'todo',
      priority: initial.priority || 'medium',
      estimated_hours: initial.estimated_hours || 0,
      rate: initial.rate || 0,
      category: initial.category || 'dev',
      stage_id: initial.stage_id || ''
    });
  }, [initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input className="input" placeholder="Título *" value={form.title} onChange={e => set('title', e.target.value)} required />
      <textarea className="input" placeholder="Descripción" value={form.description} onChange={e => set('description', e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="todo">Por Hacer</option>
          <option value="progress">En Progreso</option>
          <option value="review">Revisión</option>
          <option value="done">Completado</option>
        </select>
        <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <input type="number" className="input" placeholder="Horas est." value={form.estimated_hours} onChange={e => set('estimated_hours', parseFloat(e.target.value) || 0)} />
        <input type="number" className="input" placeholder="Tarifa/h" value={form.rate} onChange={e => set('rate', parseFloat(e.target.value) || 0)} />
        <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="dev">dev</option>
          <option value="design">design</option>
          <option value="pm">pm</option>
          <option value="qa">qa</option>
          <option value="discovery">discovery</option>
          <option value="review">review</option>
          <option value="other">other</option>
        </select>
      </div>
      <select className="input" value={form.stage_id} onChange={e => set('stage_id', e.target.value ? Number(e.target.value) : '')}>
        <option value="">Sin etapa</option>
        {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}

function ManualTimeEntry({ projectId, onAdded }) {
  const [hours, setHours] = useState(0);
  const [desc, setDesc] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!hours) return;
    await api.createTimeEntry({ project_id: projectId, hours: parseFloat(hours), description: desc });
    setHours(0); setDesc('');
    onAdded();
  };
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <input className="input" style={{ width: 100 }} type="number" step="0.25" placeholder="Horas" value={hours} onChange={e => setHours(e.target.value)} />
      <input className="input" style={{ flex: 1 }} placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} />
      <button type="submit" className="btn btn-primary"><Plus size={16} /> Registrar</button>
    </form>
  );
}

function BudgetTab({ projectId, lineItems, stages, onReload }) {
  const [desc, setDesc] = useState('');
  const [hours, setHours] = useState(0);
  const [rate, setRate] = useState(0);
  const [category, setCategory] = useState('dev');
  const [stageId, setStageId] = useState('');

  const add = async (e) => {
    e.preventDefault();
    if (!desc.trim()) return;
    await api.createLineItem({ project_id: projectId, stage_id: stageId || null, description: desc, hours: parseFloat(hours), rate: parseFloat(rate), category });
    setDesc(''); setHours(0); setRate(0);
    onReload();
  };

  const del = async (id) => { await api.deleteLineItem(id); onReload(); };

  const total = lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const byCategory = {};
  lineItems.forEach(i => { byCategory[i.category] = (byCategory[i.category] || 0) + i.amount; });

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Líneas de Costo</h3>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Descripción" value={desc} onChange={e => setDesc(e.target.value)} />
        <input className="input" style={{ width: 80 }} type="number" step="0.5" placeholder="hs" value={hours} onChange={e => setHours(e.target.value)} />
        <input className="input" style={{ width: 80 }} type="number" placeholder="$/h" value={rate} onChange={e => setRate(e.target.value)} />
        <select className="input" style={{ width: 'auto' }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="dev">dev</option>
          <option value="design">design</option>
          <option value="pm">pm</option>
          <option value="qa">qa</option>
          <option value="discovery">discovery</option>
          <option value="review">review</option>
          <option value="other">other</option>
        </select>
        <select className="input" style={{ width: 'auto' }} value={stageId} onChange={e => setStageId(e.target.value)}>
          <option value="">Sin etapa</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="submit" className="btn btn-primary"><Plus size={16} /></button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Descripción</th>
            <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Cat</th>
            <th style={{ textAlign: 'right', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Horas</th>
            <th style={{ textAlign: 'right', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Tarifa</th>
            <th style={{ textAlign: 'right', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Monto</th>
            <th style={{ padding: '8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map(i => (
            <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px', fontSize: 13 }}>{i.description}</td>
              <td style={{ padding: '8px', fontSize: 12 }}>{i.category}</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 13 }}>{i.hours}h</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 13 }}>{money(i.rate)}</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{money(i.amount)}</td>
              <td style={{ padding: '8px' }}>
                <button className="btn btn-danger btn-sm" onClick={() => del(i.id)}><Trash2 size={12} /></button>
              </td>
            </tr>
          ))}
          {lineItems.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Sin items.</td></tr>
          )}
        </tbody>
        {lineItems.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td colSpan={4} style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right' }}>TOTAL</td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, fontSize: 16, color: 'var(--danger)' }}>{money(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>

      {Object.keys(byCategory).length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>Costo por categoría</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(byCategory).map(([cat, amt]) => (
              <div key={cat} style={{ padding: '8px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                <strong>{cat}</strong>: {money(amt)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}