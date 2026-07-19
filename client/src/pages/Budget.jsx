import { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Calculator, Download } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { ROLE_NAMES } from '../roles.js';
import { downloadBudgetPDF } from '../pdf.js';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

export default function Budget() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [assumptions, setAssumptions] = useState([]);
  const [rates, setRates] = useState([]);
  const [newAssumption, setNewAssumption] = useState('');

  const load = async () => {
    const ps = await api.getProjects();
    setProjects(ps);
    if (ps.length && !selectedId) setSelectedId(ps[0].id);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const [li, as, r] = await Promise.all([
        api.getLineItems(selectedId), api.getAssumptions(selectedId), api.getRates(selectedId)
      ]);
      setLineItems(li); setAssumptions(as); setRates(r);
    })();
  }, [selectedId]);

  const selected = projects.find(p => p.id === selectedId);
  const totalCost = lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const totalHours = lineItems.reduce((s, i) => s + (i.hours || 0), 0);
  const bufferAmount = selected ? (selected.budget || 0) * (selected.buffer_percent || 20) / 100 : 0;
  const grandTotal = (selected?.budget || 0) + bufferAmount;
  const margin = grandTotal - totalCost;

  const addLineItem = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.createLineItem({
      project_id: Number(selectedId),
      description: fd.get('desc'),
      hours: parseFloat(fd.get('hours')) || 0,
      rate: parseFloat(fd.get('rate')) || 0,
      category: fd.get('cat')
    });
    e.target.reset();
    const li = await api.getLineItems(selectedId);
    setLineItems(li);
  };

  const delLine = async (id) => { await api.deleteLineItem(id); const li = await api.getLineItems(selectedId); setLineItems(li); };

  const updateRate = async (id, val) => { await api.updateRate(id, { hourly_rate: parseFloat(val) }); const r = await api.getRates(selectedId); setRates(r); };

  const addAssumption = async (e) => {
    e.preventDefault();
    if (!newAssumption.trim()) return;
    await api.createAssumption({ project_id: Number(selectedId), text: newAssumption });
    setNewAssumption('');
    const as = await api.getAssumptions(selectedId);
    setAssumptions(as);
  };

  const delAssumption = async (id) => { await api.deleteAssumption(id); const as = await api.getAssumptions(selectedId); setAssumptions(as); };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>Presupuestos</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Gestión administrativa: costos, tarifas, asunciones y márgenes.</p>
      {selected && (
        <button className="btn btn-primary" onClick={async () => {
          try {
            const stages = await api.getStages(selectedId);
            downloadBudgetPDF(selected, lineItems, stages, bufferAmount);
          } catch (e) {
            alert('Error generando PDF: ' + e.message);
          }
        }} style={{ marginBottom: 16 }}>
          <Download size={16} /> Exportar PDF
        </button>
      )}

      {/* Project selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
        {projects.map(p => (
          <button
            key={p.id}
            className="btn"
            style={{
              background: p.id === selectedId ? 'var(--accent)' : 'var(--surface)',
              color: p.id === selectedId ? 'white' : 'var(--text)',
              border: '1px solid var(--border)',
              whiteSpace: 'nowrap'
            }}
            onClick={() => setSelectedId(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!selected ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          Selecciona o crea un proyecto
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Presupuesto</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{money(selected.budget)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">+ Buffer</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{money(bufferAmount)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Cliente</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--success)' }}>{money(grandTotal)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Costo Real</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--danger)' }}>{money(totalCost)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Horas</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{totalHours.toFixed(1)}h</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Margen</div>
              <div className="stat-value" style={{ fontSize: 20, color: margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {money(margin)}
              </div>
            </div>
          </div>

          <div className="budget-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Line items */}
            <div className="card">
              <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={18} /> Líneas de Costo
              </h3>
              <form onSubmit={addLineItem} style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 150 }} name="desc" placeholder="Descripción" required />
                <input className="input" style={{ width: 70 }} type="number" step="0.5" name="hours" placeholder="hs" defaultValue="0" />
                <input className="input" style={{ width: 70 }} type="number" name="rate" placeholder="$/h" defaultValue="0" />
                <select className="input" style={{ width: 'auto' }} name="cat">
                  <option value="dev">dev</option>
                  <option value="design">design</option>
                  <option value="pm">pm</option>
                  <option value="qa">qa</option>
                  <option value="discovery">discovery</option>
                  <option value="review">review</option>
                  <option value="other">other</option>
                </select>
                <button type="submit" className="btn btn-primary"><Plus size={16} /></button>
              </form>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px', fontSize: 12, color: 'var(--muted)' }}>Desc</th>
                    <th style={{ textAlign: 'right', padding: '6px', fontSize: 12, color: 'var(--muted)' }}>Horas</th>
                    <th style={{ textAlign: 'right', padding: '6px', fontSize: 12, color: 'var(--muted)' }}>Tarifa</th>
                    <th style={{ textAlign: 'right', padding: '6px', fontSize: 12, color: 'var(--muted)' }}>Total</th>
                    <th style={{ padding: '6px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(i => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px', fontSize: 13 }}>{i.description} <span className="badge badge-todo">{i.category}</span></td>
                      <td style={{ padding: '6px', textAlign: 'right', fontSize: 13 }}>{i.hours}h</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontSize: 13 }}>{money(i.rate)}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>{money(i.amount)}</td>
                      <td style={{ padding: '6px' }}>
                        <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px' }} onClick={() => delLine(i.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>Sin items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rates & assumptions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <h3 style={{ marginTop: 0, fontSize: 16 }}>Tarifas por Rol</h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Edita el costo/hora interno.</p>
                {rates.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>
                      <span className="role-full">{ROLE_NAMES[r.role] || r.role}</span>
                      <span className="role-short">{r.role}</span>
                    </span>
                    <input
                      className="input"
                      style={{ width: 100 }}
                      type="number"
                      defaultValue={r.hourly_rate}
                      onBlur={(e) => updateRate(r.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0, fontSize: 16 }}>
                  <FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Asunciones
                </h3>
                <form onSubmit={addAssumption} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <input className="input" placeholder="Nueva…" value={newAssumption} onChange={e => setNewAssumption(e.target.value)} />
                  <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /></button>
                </form>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {assumptions.map(a => (
                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                      <span>{a.text}</span>
                      <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px' }} onClick={() => delAssumption(a.id)}><Trash2 size={12} /></button>
                    </li>
                  ))}
                  {assumptions.length === 0 && <li style={{ color: 'var(--muted)', fontSize: 13 }}>Sin asunciones</li>}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}