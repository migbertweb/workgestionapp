import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { LayoutDashboard, FolderKanban, BarChart3, Users, FileText, Settings, Briefcase, Sun, Moon, Menu, X, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Analytics from './pages/Analytics.jsx';
import Clients from './pages/Clients.jsx';
import Invoices from './pages/Invoices.jsx';
import SettingsPage from './pages/Settings.jsx';
import Budget from './pages/Budget.jsx';

// Toast context
export const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={add}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 14,
            background: t.type === 'error' ? 'var(--danger)' : t.type === 'success' ? 'var(--success)' : 'var(--accent)',
            color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', animation: 'slideIn 0.2s ease'
          }}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Proyectos' },
  { to: '/budget', icon: Briefcase, label: 'Presupuestos' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/invoices', icon: FileText, label: 'Facturas' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
];

export default function App() {
  const loc = useLocation();
  const { user, loading, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('workapp-theme') || 'dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('workapp-theme', theme);
  }, [theme]);

  useEffect(() => { setMobileMenuOpen(false); }, [loc.pathname]);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', background: 'var(--bg)' }}>Cargando…</div>;
  if (!user) return <Login />;

  const sidebar = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #818cf8, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 18, color: 'white'
        }}>W</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>WorkApp</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Freelance Manager</div>
        </div>
      </div>
      {navItems.map(item => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <item.icon size={18} />{item.label}
        </NavLink>
      ))}
      <button
        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        className="sidebar-link"
        style={{ marginTop: 8 }}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
      </button>
      <button onClick={logout} className="sidebar-link" style={{ color: 'var(--danger)' }}>
        <LogOut size={18} /> Cerrar Sesión
      </button>
      <div style={{ marginTop: 'auto', padding: '12px 8px', fontSize: 11, color: 'var(--muted)' }}>
        v1.0.0 · Local
      </div>
    </>
  );

  return (
    <ToastProvider>
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <aside className="desktop-sidebar" style={{
        width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: 20, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
      }}>
        {sidebar}
      </aside>

      {/* Mobile header */}
      <div className="mobile-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 52,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'none', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: 'white'
          }}>W</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>WorkApp</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} style={{
          background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4
        }}>
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: 260,
            background: 'var(--surface)', borderRight: '1px solid var(--border)',
            padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setMobileMenuOpen(false)} style={{
                background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4
              }}>
                <X size={22} />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      <main className="main-content" style={{ flex: 1, overflow: 'auto', padding: 32, maxWidth: 'calc(100vw - 240px)' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
    </ToastProvider>
  );
}