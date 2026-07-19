import { useState, useEffect } from 'react';
import { api } from '../api.js';

const ICONS = {
  create: '🆕',
  complete: '✅',
  update: '✏️',
  delete: '🗑',
};

const ENTITY_LABEL = {
  project: 'Proyecto',
  task: 'Tarea',
  invoice: 'Factura',
  client: 'Cliente',
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

export default function ActivityFeed({ projectId, compact }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fn = projectId ? api.getProjectActivity(projectId) : api.getActivity(20);
    fn.then(setItems).catch(() => {});
  }, [projectId]);

  if (items.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: projectId ? 0 : 28 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
        {compact ? 'Actividad reciente' : 'Actividad Reciente'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, compact ? 5 : items.length).map(a => {
          const icon = ICONS[a.action] || '📌';
          const entity = ENTITY_LABEL[a.entity] || a.entity;
          const projectLabel = a.project_name ? ` en ${a.project_name}` : '';
          return (
            <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
              <span style={{ flexShrink: 0, fontSize: 16 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {a.action === 'create' ? 'creó' : a.action === 'complete' ? 'completó' : a.action === 'update' ? 'actualizó' : 'eliminó'}
                </span>{' '}
                {entity} <strong>{a.name}</strong>
                {projectLabel && <span style={{ color: 'var(--muted)' }}>{projectLabel}</span>}
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap', marginTop: 2 }}>
                {timeAgo(a.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
