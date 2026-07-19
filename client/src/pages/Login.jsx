import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 40, width: '100%', maxWidth: 400
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22, color: 'white'
          }}>W</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>WorkApp</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Iniciá sesión para continuar</p>
        </div>

        {error && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Usuario</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Contraseña</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifyContent: 'center', padding: '12px' }}>
            {busy ? 'Ingresando…' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}