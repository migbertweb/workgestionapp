import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Mail, Phone, Building } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState(null);

  const load = async () => setClients(await api.getClients());
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (editClient) await api.updateClient(editClient.id, data);
    else await api.createClient(data);
    setShowModal(false);
    setEditClient(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar cliente?')) return;
    await api.deleteClient(id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Clientes</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>{clients.length} clientes registrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          No hay clientes. Agrega el primero.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {clients.map(c => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{c.name}</h3>
                  {c.company && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.company}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditClient(c)}><Edit2 size={14} /></button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {c.email && <span><Mail size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{c.email}</span>}
                {c.phone && <span><Phone size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{c.phone}</span>}
                {!c.email && !c.phone && <span style={{ opacity: 0.5 }}>Sin contacto</span>}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}><strong>{c.project_count || 0}</strong> proyectos</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{money(c.total_budget || 0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal || !!editClient} onClose={() => { setShowModal(false); setEditClient(null); }} title={editClient ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <ClientForm initial={editClient} onSubmit={handleSave} onCancel={() => { setShowModal(false); setEditClient(null); }} />
      </Modal>
    </div>
  );
}

function ClientForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' });
  useEffect(() => {
    if (initial) setForm({ name: initial.name || '', email: initial.email || '', phone: initial.phone || '', company: initial.company || '' });
  }, [initial]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
      <div><label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Empresa</label>
        <input className="input" value={form.company} onChange={e => set('company', e.target.value)} /></div>
      <div><label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Email</label>
        <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
      <div><label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Teléfono</label>
        <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}