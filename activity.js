import { db } from './db.js';

function log({ project_id, username, action, entity, entity_id, name, details }) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO activity_log (project_id, username, action, entity, entity_id, name, details, created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(project_id || null, username || 'sistema', action, entity, entity_id || null, name || null, details || null, now);
}

export const activity = { log };
