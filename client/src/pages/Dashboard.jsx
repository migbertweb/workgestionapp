import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, Clock, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import ProjectForm from '../components/ProjectForm.jsx';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [p, a] = await Promise.all([api.getProjects(), api.getAnalytics()]);
      setProjects(p);
      setAnalytics(a);
      setError('');
    } catch (e) {
      setError('Error cargando: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await api.createProject(data);
      setShowModal(false);
      await load();
    } catch (e) {
      setError('Error creando proyecto: ' + e.message);
    }
  };

  if (loading) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;

  const activeProjects = projects.filter(p => p.status === 'active');
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalHours = analytics?.totalLoggedHours || 0;
  const totalRevenue = analytics?.totalRevenue || 0;
  const pendingRevenue = analytics?.pendingRevenue || 0;

  return (
    <div>
      {error && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>
          <button className="btn btn-primary btn-sm" onClick={load}>Reintentar</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>Resumen general de tu actividad freelance</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Proyecto
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
            <FolderKanban size={18} /> <span className="stat-label">Proyectos Activos</span>
          </div>
          <div className="stat-value">{activeProjects.length}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{projects.length} totales</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
            <DollarSign size={18} /> <span className="stat-label">Presupuesto Total</span>
          </div>
          <div className="stat-value">{money(totalBudget)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Suma de todos los proyectos</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
            <Clock size={18} /> <span className="stat-label">Horas Logueadas</span>
          </div>
          <div className="stat-value">{totalHours.toFixed(1)}h</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tiempo total registrado</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
            <TrendingUp size={18} /> <span className="stat-label">Ingresos</span>
          </div>
          <div className="stat-value">{money(totalRevenue)}</div>
          <div style={{ fontSize: 12, color: 'var(--warning)' }}>{money(pendingRevenue)} pendiente</div>
        </div>
      </div>

      {/* Projects grid */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Proyectos Recientes</h2>
        <Link to="/projects" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          Ver todos →
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <AlertCircle size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>No hay proyectos aún</p>
          <p>Crea tu primer proyecto para empezar.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
            <Plus size={18} /> Crear Proyecto
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {projects.slice(0, 8).map(p => {
            const stagePct = p.total_stages ? Math.round((p.done_stages / p.total_stages) * 100) : 0;
            const taskPct = p.total_tasks ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0;
            return (
              <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="project-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{p.name}</h3>
                    <span className={`badge badge-${p.status}`}>{p.status}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
                    {p.client || 'Sin cliente'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--muted)' }}>Etapas</span>
                    <span>{p.done_stages || 0}/{p.total_stages || 0}</span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 10 }}>
                    <div className="progress-fill" style={{ width: `${stagePct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--muted)' }}>Tasks</span>
                    <span>{p.done_tasks || 0}/{p.total_tasks || 0}</span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 12 }}>
                    <div className="progress-fill" style={{ width: `${taskPct}%`, background: 'var(--success)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{money(p.budget)}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{(p.logged_hours || 0).toFixed(1)}h log</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Proyecto">
        <ProjectForm onSubmit={handleCreate} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  );
}