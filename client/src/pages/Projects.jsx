import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Copy } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import ProjectForm from '../components/ProjectForm.jsx';

const BASE = '/api';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    try {
      const p = await api.getProjects();
      setProjects(p);
      setError('');
    } catch (e) {
      setError('Error: ' + e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await api.createProject(data);
      setShowModal(false);
      load();
    } catch (e) {
      setError('Error creando: ' + e.message);
    }
  };

  const handleEdit = async (data) => {
    try {
      await api.updateProject(editProject.id, data);
      setEditProject(null);
      load();
    } catch (e) {
      setError('Error editando: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar proyecto y todos sus datos?')) return;
    await api.deleteProject(id);
    load();
  };

  const handleClone = async (id, includeLineItems) => {
    if (!confirm(`¿Clonar proyecto${includeLineItems ? ' con line items' : ' (solo estructura)'}?`)) return;
    try {
      await api.cloneProject(id, includeLineItems);
      load();
    } catch (e) {
      setError('Error clonando: ' + e.message);
    }
  };

  const exportCSV = () => window.open(`${BASE}/projects/export/csv`);

  return (
    <div>
      {error && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>
          <button className="btn btn-primary btn-sm" onClick={load}>Reintentar</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Proyectos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={exportCSV}>📥 CSV</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Nuevo Proyecto
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--muted)' }}>No hay proyectos. Crea el primero.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {projects.map(p => {
            const stagePct = p.total_stages ? Math.round((p.done_stages / p.total_stages) * 100) : 0;
            return (
              <div key={p.id} className="project-card" onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
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
                <div className="progress-bar" style={{ marginBottom: 12 }}>
                  <div className="progress-fill" style={{ '--pct': stagePct / 100 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{money(p.budget)}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(p.logged_hours || 0).toFixed(1)}h · {money(p.total_cost || 0)} cost</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleClone(p.id, false); }} title="Clonar estructura">
                      <Copy size={14} />
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setEditProject(p); }}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Proyecto">
        <ProjectForm onSubmit={handleCreate} onCancel={() => setShowModal(false)} />
      </Modal>

      <Modal open={!!editProject} onClose={() => setEditProject(null)} title="Editar Proyecto">
        <ProjectForm initial={editProject} onSubmit={handleEdit} onCancel={() => setEditProject(null)} />
      </Modal>
    </div>
  );
}