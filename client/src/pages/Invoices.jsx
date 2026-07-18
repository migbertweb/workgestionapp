import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FileText } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

const STATUS_LABELS = {
  draft: { label: 'Borrador', cls: 'badge-draft' },
  sent: { label: 'Enviada', cls: 'badge-sent' },
  paid: { label: 'Pagada', cls: 'badge-paid' },
  overdue: { label: 'Vencida', cls: 'badge-overdue' }
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editInv, setEditInv] = useState(null);

  const load = async () => {
    const [i, p] = await Promise.all([api.getInvoices(), api.getProjects()]);
    setInvoices(i);
    setProjects(p);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (editInv) await api.updateInvoice(editInv.id, data);
    else await api.createInvoice(data);
    setShowModal(false);
    setEditInv(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar factura?')) return;
    await api.deleteInvoice(id);
    load();
  };

  const total = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter(i => ['draft', 'sent'].includes(i.status)).reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Facturas</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>{money(total)} cobrado · {money(pending)} pendiente</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nueva Factura
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No hay facturas. Crea la primera.</p>
        </div>
      ) : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>N°</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Proyecto</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Cliente</th>
                <th style={{ textAlign: 'right', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Monto</th>
                <th style={{ textAlign: 'center', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Estado</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Vence</th>
                <th style={{ padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const st = STATUS_LABELS[inv.status] || STATUS_LABELS.draft;
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontSize: 13, fontWeight: 600 }}>{inv.number || `#${inv.id}`}</td>
                    <td style={{ padding: '8px', fontSize: 13 }}>{inv.project_name || '—'}</td>
                    <td style={{ padding: '8px', fontSize: 13 }}>{inv.client || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{money(inv.amount)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td style={{ padding: '8px', fontSize: 13 }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditInv(inv)}><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inv.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal || !!editInv} onClose={() => { setShowModal(false); setEditInv(null); }} title={editInv ? 'Editar Factura' : 'Nueva Factura'}>
        <InvoiceForm initial={editInv} projects={projects} onSubmit={handleSave} onCancel={() => { setShowModal(false); setEditInv(null); }} />
      </Modal>
    </div>
  );
}

function InvoiceForm({ initial, projects, onSubmit, onCancel }) {
  const [form, setForm] = useState({ project_id: '', number: '', amount: 0, status: 'draft', due_date: '', notes: '' });
  useEffect(() => {
    if (initial) setForm({
      project_id: initial.project_id || '',
      number: initial.number || '',
      amount: initial.amount || 0,
      status: initial.status || 'draft',
      due_date: initial.due_date || '',
      notes: initial.notes || ''
    });
  }, [initial]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Proyecto</label>
        <select className="input" value={form.project_id} onChange={e => set('project_id', e.target.value ? Number(e.target.value) : '')}>
          <option value="">—</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Número</label>
          <input className="input" value={form.number} onChange={e => set('number', e.target.value)} placeholder="INV-2025-001" />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Monto</label>
          <input className="input" type="number" value={form.amount} onChange={e => set('amount', parseFloat(e.target.value) || 0)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="draft">Borrador</option>
            <option value="sent">Enviada</option>
            <option value="paid">Pagada</option>
            <option value="overdue">Vencida</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Vence</label>
          <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Notas</label>
        <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}