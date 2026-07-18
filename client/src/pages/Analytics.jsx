import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { DollarSign, Clock, FolderKanban, TrendingUp, Award } from 'lucide-react';
import { api } from '../api.js';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899'];
const STATUS_COLORS = { active: '#3b82f6', completed: '#22c55e', paused: '#f59e0b' };

export default function Analytics() {
  const [data, setData] = useState(null);
  const [marketRates, setMarketRates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [a, mr, p] = await Promise.all([api.getAnalytics(), api.getMarketRates(), api.getProjects()]);
      setData(a);
      setMarketRates(mr);
      setProjects(p);
      setError('');
    } catch (e) {
      setError('Error cargando métricas: ' + e.message);
    }
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  if (error) return <div className="card"><p style={{ color: 'var(--danger)' }}>{error}</p><button className="btn btn-primary" onClick={load}>Reintentar</button></div>;
  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;

  const budgetData = data.budgetByProject.map(p => ({ name: p.name.slice(0, 15), value: p.budget }));
  const hoursData = data.hoursByProject.map(p => ({ name: p.name.slice(0, 15), hours: p.hours }));
  const statusData = data.projectsByStatus.map(s => ({ name: s.status, value: s.count, fill: STATUS_COLORS[s.status] || '#6366f1' }));
  const taskStatusData = data.tasksByStatus.map(s => ({ name: s.status, value: s.count }));
  const revenueData = data.revenueTimeline.map(r => ({ month: r.month, revenue: r.total })).reverse();
  const costCatData = data.costByCategory.map(c => ({ name: c.category, value: c.total }));

  // Compare project budgets vs market rates
  const comparisonData = projects.slice(0, 8).map(p => {
    // Find a rough market median for comparison
    return {
      name: p.name.slice(0, 12),
      Presupuesto: p.budget,
      'Market Median': 2500, // Average reference
    };
  });

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>Analytics</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Métricas en tiempo real · actualización cada 30s</p>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
            <FolderKanban size={16} /> <span className="stat-label">Proyectos</span>
          </div>
          <div className="stat-value" style={{ fontSize: 24 }}>{data.totalProjects}</div>
          <div style={{ fontSize: 12, color: 'var(--success)' }}>{data.activeProjects} activos</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
            <DollarSign size={16} /> <span className="stat-label">Presupuesto Total</span>
          </div>
          <div className="stat-value" style={{ fontSize: 24 }}>{money(data.totalBudget)}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
            <Clock size={16} /> <span className="stat-label">Horas Logueadas</span>
          </div>
          <div className="stat-value" style={{ fontSize: 24 }}>{data.totalLoggedHours.toFixed(1)}h</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
            <TrendingUp size={16} /> <span className="stat-label">Ingresos</span>
          </div>
          <div className="stat-value" style={{ fontSize: 24, color: 'var(--success)' }}>{money(data.totalRevenue)}</div>
          <div style={{ fontSize: 12, color: 'var(--warning)' }}>{money(data.pendingRevenue)} pendiente</div>
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Budget by project */}
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Presupuesto por Proyecto</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={budgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hours by project */}
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Horas por Proyecto</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
              <Bar dataKey="hours" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Project status pie */}
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Proyectos por Estado</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Task status */}
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Tareas por Estado</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={taskStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue timeline */}
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Ingresos Mensuales</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by category */}
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Costo por Categoría</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={costCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {costCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Market rates reference */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={18} /> Precios de Mercado · Freelance
        </h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Referencia de tarifas comunes para comparar tus presupuestos.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Categoría</th>
                <th style={{ textAlign: 'right', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Mín</th>
                <th style={{ textAlign: 'right', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Mediana</th>
                <th style={{ textAlign: 'right', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Máx</th>
                <th style={{ textAlign: 'center', padding: '8px', fontSize: 13, color: 'var(--muted)' }}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {marketRates.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', fontSize: 13, fontWeight: 600 }}>{r.category}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: 'var(--danger)' }}>{money(r.low)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>{money(r.median)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: 'var(--accent-hover)' }}>{money(r.high)}</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget comparison chart */}
      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Presupuesto vs Market Median</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="Presupuesto" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Market Median" fill="#475569" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}