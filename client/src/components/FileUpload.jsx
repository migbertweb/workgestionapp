import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, File, Download } from 'lucide-react';
import { api } from '../api.js';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function FileUpload({ projectId }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const load = () => api.getAttachments(projectId).then(setFiles).catch(() => {});

  useEffect(() => { load(); }, [projectId]);

  const handleUpload = async (file) => {
    await api.uploadFile(projectId, file);
    load();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (id) => {
    await api.deleteAttachment(id);
    load();
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0, fontSize: 16 }}>Archivos</h3>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(99,102,241,0.05)' : 'var(--bg)',
          transition: 'all 0.15s',
          marginBottom: 16,
        }}
      >
        <Upload size={28} style={{ color: 'var(--muted)', marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
          Arrastrá archivos o click para subir
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>
          Máx 10 MB
        </p>
        <input ref={inputRef} type="file" hidden onChange={e => { const f = e.target.files[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'var(--bg)', borderRadius: 8, fontSize: 13,
            }}>
              <File size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.original_name}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {formatSize(f.size)}
              </span>
              <a href={`/api/attachments/download/${f.id}`} style={{ display: 'flex', color: 'var(--accent)' }} title="Descargar">
                <Download size={14} />
              </a>
              <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px' }} onClick={() => handleDelete(f.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', margin: 0 }}>
          Sin archivos todavía
        </p>
      )}
    </div>
  );
}
