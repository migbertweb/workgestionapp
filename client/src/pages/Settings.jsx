import { useState } from 'react';
import { Settings as SettingsIcon, Info, Database, Github, Lock } from 'lucide-react';

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage(''); setError('');
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    setBusy(true);
    try {
      const token = localStorage.getItem('workapp_token');
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage('Contraseña actualizada correctamente');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>Ajustes</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Configuración general de WorkApp.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Cambiar Contraseña */}
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} /> Cambiar Contraseña
          </h3>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Contraseña actual</label>
              <input className="input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Nueva contraseña</label>
              <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={4} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Confirmar nueva</label>
              <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            {message && <div style={{ padding: '8px 12px', background: '#14532d', color: '#4ade80', borderRadius: 8, fontSize: 13 }}>{message}</div>}
            {error && <div style={{ padding: '8px 12px', background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifyContent: 'center' }}>
              {busy ? 'Actualizando…' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={18} /> Información
          </h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>Versión</td><td style={{ padding: '6px 0', textAlign: 'right' }}>1.0.0</td></tr>
              <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>Stack</td><td style={{ padding: '6px 0', textAlign: 'right' }}>Express + SQLite + React</td></tr>
              <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>API</td><td style={{ padding: '6px 0', textAlign: 'right' }}>localhost:3001</td></tr>
              <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>Frontend</td><td style={{ padding: '6px 0', textAlign: 'right' }}>Vite + Tailwind v4</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} /> Datos
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            La base de datos SQLite se almacena localmente en <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>workapp.db</code>.
            Todos los datos viven en tu máquina.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <a className="btn btn-secondary" href="/api/analytics" target="_blank">Ver API Analytics</a>
            <a className="btn btn-secondary" href="/api/projects" target="_blank">Ver API Projects</a>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingsIcon size={18} /> Preferencias
          </h3>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Moneda por defecto</span><strong>USD</strong>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Buffer recomendado</span><strong>20%</strong>
            </div>
            <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Etapas por defecto</span><strong>6</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Github size={18} /> About
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            WorkApp Agent — app de gestión y seguimiento de proyectos freelance.
            Inspirado en budget-app, expandido con kanban, timer, facturas, clientes y analytics.
            Backend Express+SQLite, frontend React+Tailwind.
          </p>
        </div>
      </div>
    </div>
  );
}