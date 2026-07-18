import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function ProjectForm({ onSubmit, initial, onCancel }) {
  const [form, setForm] = useState({
    name: '', client: '', budget: 0, buffer_percent: 20,
    currency: 'USD', deadline: '', description: ''
  });
  const [clients, setClients] = useState([]);

  useEffect(() => {
    api.getClients().then(setClients).catch(() => {});
  }, []);

  useEffect(() => {
    if (initial) setForm({
      name: initial.name || '',
      client: initial.client || '',
      budget: initial.budget || 0,
      buffer_percent: initial.buffer_percent || 20,
      currency: initial.currency || 'USD',
      deadline: initial.deadline || '',
      description: initial.description || ''
    });
  }, [initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const fieldStyle = { marginBottom: 14 };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--muted)' };

  return (
    <form onSubmit={submit}>
      <div style={fieldStyle}>
        <label style={labelStyle}>Nombre *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Cliente</label>
        <input
          className="input"
          value={form.client}
          onChange={e => set('client', e.target.value)}
          list="client-list"
          placeholder="Seleccioná o escribí un cliente..."
        />
        <datalist id="client-list">
          {clients.map(c => <option key={c.id} value={c.name} />)}
        </datalist>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Presupuesto</label>
          <input type="number" className="input" value={form.budget} onChange={e => set('budget', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label style={labelStyle}>Buffer %</label>
          <input type="number" className="input" value={form.buffer_percent} onChange={e => set('buffer_percent', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label style={labelStyle}>Moneda</label>
          <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="BRL">BRL</option>
          </select>
        </div>
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Deadline</label>
        <input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Descripción</label>
        <textarea className="input" value={form.description} onChange={e => set('description', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}