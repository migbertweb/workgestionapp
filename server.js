import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, bootstrap } from './db.js';
import { seedAdmin, requireAuth, authRoutes } from './auth.js';
import { notify } from './notify.js';
import { activity } from './activity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend build if exists
const clientBuild = path.join(__dirname, 'client', 'dist');
app.use('/assets', express.static(path.join(clientBuild, 'assets')));

// ─── Auth routes (public) ───────────────────────────────────────
authRoutes(app);

// ─── API (protected) ────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  // Skip auth routes and market_rates (public)
  if (req.path.startsWith('/auth') || req.path === '/market_rates') return next();
  requireAuth(req, res, next);
});

// Projects
app.get('/api/projects', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM stages s WHERE s.project_id = p.id) AS total_stages,
      (SELECT COUNT(*) FROM stages s WHERE s.project_id = p.id AND s.status = 'done') AS done_stages,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks,
      (SELECT COALESCE(SUM(te.hours),0) FROM time_entries te WHERE te.project_id = p.id) AS logged_hours,
      (SELECT COALESCE(SUM(li.amount),0) FROM line_items li WHERE li.project_id = p.id) AS total_cost
    FROM projects p ORDER BY p.id DESC
  `).all();
  res.json(rows);
});

app.get('/api/projects/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM stages s WHERE s.project_id = p.id) AS total_stages,
      (SELECT COUNT(*) FROM stages s WHERE s.project_id = p.id AND s.status='done') AS done_stages
    FROM projects p WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ message: 'Proyecto no encontrado' });
  res.json(p);
});

app.post('/api/projects', async (req, res) => {
  const { name, client, budget, buffer_percent, currency, deadline, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Nombre requerido' });
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO projects (name, client, budget, buffer_percent, currency, deadline, description, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(name, client || null, budget || 0, buffer_percent || 20, currency || 'USD', deadline || null, description || null, 'active', now, now);
  const id = result.lastInsertRowid;
  // Default stages
  const defaultStages = ['Discovery', 'Presupuesto', 'Contrato', 'Ejecución', 'QA', 'Entregado'];
  const stmt = db.prepare(`INSERT INTO stages (project_id, name, status, position, updated_at) VALUES (?,?,?,?,?)`);
  defaultStages.forEach((name, i) => stmt.run(id, name, 'todo', i, now));
  // Default rates
  ['dev', 'design', 'pm', 'qa'].forEach(role => {
    db.prepare(`INSERT INTO project_rates (project_id, role, hourly_rate) VALUES (?,?,?)`).run(id, role, role === 'dev' ? 40 : role === 'design' ? 35 : role === 'pm' ? 30 : 25);
  });
  const newProject = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
  res.status(201).json(newProject);
  activity.log({ project_id: id, username: req.user?.username, action: 'create', entity: 'project', entity_id: id, name });
  await notify.projectCreated(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const { name, client, budget, buffer_percent, currency, deadline, description, status } = req.body;
  const now = new Date().toISOString();
  db.prepare(`UPDATE projects SET name=COALESCE(?,name), client=COALESCE(?,client), budget=COALESCE(?,budget), buffer_percent=COALESCE(?,buffer_percent), currency=COALESCE(?,currency), deadline=COALESCE(?,deadline), description=COALESCE(?,description), status=COALESCE(?,status), updated_at=? WHERE id=?`)
    .run(name, client, budget, buffer_percent, currency, deadline, description, status, now, req.params.id);
  res.json(db.prepare(`SELECT * FROM projects WHERE id=?`).get(req.params.id));
});

app.delete('/api/projects/:id', (req, res) => {
  db.prepare(`DELETE FROM projects WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Clone project structure
app.post('/api/projects/:id/clone', (req, res) => {
  const src = db.prepare(`SELECT * FROM projects WHERE id=?`).get(req.params.id);
  if (!src) return res.status(404).json({ message: 'Proyecto no encontrado' });
  const { include_line_items } = req.body || {};
  const now = new Date().toISOString();
  const newName = `${src.name} (copia)`;
  const result = db.prepare(`INSERT INTO projects (name, client, budget, buffer_percent, currency, deadline, description, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(newName, src.client, src.budget, src.buffer_percent, src.currency, null, src.description, 'active', now, now);
  const newId = result.lastInsertRowid;
  // Clone stages
  const stages = db.prepare(`SELECT * FROM stages WHERE project_id=? ORDER BY position`).all(req.params.id);
  const stmtStage = db.prepare(`INSERT INTO stages (project_id, name, status, position, updated_at) VALUES (?,?,?,?,?)`);
  const stageMap = {}; // oldId → newId
  stages.forEach(s => {
    const r = stmtStage.run(newId, s.name, 'todo', s.position, now);
    stageMap[s.id] = r.lastInsertRowid;
  });
  // Clone tasks (reset status to todo)
  const tasks = db.prepare(`SELECT * FROM tasks WHERE project_id=?`).all(req.params.id);
  const stmtTask = db.prepare(`INSERT INTO tasks (project_id, stage_id, title, description, status, priority, position, estimated_hours, rate, category, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  tasks.forEach(t => stmtTask.run(newId, t.stage_id ? (stageMap[t.stage_id] || null) : null, t.title, t.description, 'todo', t.priority, t.position, t.estimated_hours, t.rate, t.category, now, now));
  // Clone line items if requested
  if (include_line_items) {
    const items = db.prepare(`SELECT * FROM line_items WHERE project_id=?`).all(req.params.id);
    items.forEach(li => db.prepare(`INSERT INTO line_items (project_id, stage_id, description, hours, rate, amount, category) VALUES (?,?,?,?,?,?,?)`).run(newId, li.stage_id, li.description, li.hours, li.rate, li.amount, li.category));
  }
  // Clone rates
  const rates = db.prepare(`SELECT * FROM project_rates WHERE project_id=?`).all(req.params.id);
  rates.forEach(r => db.prepare(`INSERT INTO project_rates (project_id, role, hourly_rate) VALUES (?,?,?)`).run(newId, r.role, r.hourly_rate));
  res.status(201).json(db.prepare(`SELECT * FROM projects WHERE id=?`).get(newId));
});

// Stages
app.get('/api/stages/:projectId', (req, res) => {
  const stages = db.prepare(`SELECT * FROM stages WHERE project_id=? ORDER BY position`).all(req.params.projectId);
  res.json(stages);
});

app.put('/api/stages/:id', (req, res) => {
  const { status, progress, position } = req.body;
  const now = new Date().toISOString();
  db.prepare(`UPDATE stages SET status=COALESCE(?,status), progress=COALESCE(?,progress), position=COALESCE(?,position), updated_at=? WHERE id=?`).run(status, progress, position, now, req.params.id);
  res.json(db.prepare(`SELECT * FROM stages WHERE id=?`).get(req.params.id));
});

app.post('/api/stages', (req, res) => {
  const { project_id, name, position } = req.body;
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO stages (project_id, name, status, position, updated_at) VALUES (?,?,?,?,?)`).run(project_id, name, 'todo', position || 0, now);
  res.status(201).json(db.prepare(`SELECT * FROM stages WHERE id=?`).get(result.lastInsertRowid));
});

app.delete('/api/stages/:id', (req, res) => {
  db.prepare(`DELETE FROM stages WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Tasks
app.get('/api/tasks/:projectId', (req, res) => {
  const tasks = db.prepare(`SELECT * FROM tasks WHERE project_id=? ORDER BY position, id`).all(req.params.projectId);
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { project_id, stage_id, title, description, status, priority, position, estimated_hours, rate, category } = req.body;
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO tasks (project_id, stage_id, title, description, status, priority, position, estimated_hours, rate, category, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(project_id, stage_id || null, title, description || null, status || 'todo', priority || 'medium', position || 0, estimated_hours || 0, rate || 0, category || 'dev', now, now);
  const newTask = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(result.lastInsertRowid);
  res.status(201).json(newTask);
  activity.log({ project_id, username: req.user?.username, action: 'create', entity: 'task', entity_id: newTask.id, name: title });
});

app.put('/api/tasks/:id', async (req, res) => {
  const { stage_id, title, description, status, priority, position, estimated_hours, rate, category } = req.body;
  const now = new Date().toISOString();
  const old = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(req.params.id);
  db.prepare(`UPDATE tasks SET stage_id=COALESCE(?,stage_id), title=COALESCE(?,title), description=COALESCE(?,description), status=COALESCE(?,status), priority=COALESCE(?,priority), position=COALESCE(?,position), estimated_hours=COALESCE(?,estimated_hours), rate=COALESCE(?,rate), category=COALESCE(?,category), updated_at=? WHERE id=?`)
    .run(stage_id, title, description, status, priority, position, estimated_hours, rate, category, now, req.params.id);
  const updated = db.prepare(`SELECT * FROM tasks WHERE id=?`).get(req.params.id);
  res.json(updated);
  // Notify on transition to done
  if (status === 'done' && old.status !== 'done') {
    const project = db.prepare(`SELECT name FROM projects WHERE id=?`).get(updated.project_id);
    await notify.taskCompleted(updated, project?.name || 'Desconocido');
    activity.log({ project_id: updated.project_id, username: req.user?.username, action: 'complete', entity: 'task', entity_id: updated.id, name: updated.title });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare(`DELETE FROM tasks WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Line items
app.get('/api/line_items/:projectId', (req, res) => {
  res.json(db.prepare(`SELECT * FROM line_items WHERE project_id=? ORDER BY id`).all(req.params.projectId));
});

app.post('/api/line_items', (req, res) => {
  const { project_id, stage_id, description, hours, rate, category } = req.body;
  const amount = (hours || 0) * (rate || 0);
  const result = db.prepare(`INSERT INTO line_items (project_id, stage_id, description, hours, rate, amount, category) VALUES (?,?,?,?,?,?,?)`).run(project_id, stage_id || null, description, hours || 0, rate || 0, amount, category || 'dev');
  res.status(201).json(db.prepare(`SELECT * FROM line_items WHERE id=?`).get(result.lastInsertRowid));
});

app.put('/api/line_items/:id', (req, res) => {
  const { description, hours, rate, category } = req.body;
  const amount = (hours || 0) * (rate || 0);
  db.prepare(`UPDATE line_items SET description=COALESCE(?,description), hours=COALESCE(?,hours), rate=COALESCE(?,rate), amount=?, category=COALESCE(?,category) WHERE id=?`).run(description, hours, rate, amount, category, req.params.id);
  res.json(db.prepare(`SELECT * FROM line_items WHERE id=?`).get(req.params.id));
});

app.delete('/api/line_items/:id', (req, res) => {
  db.prepare(`DELETE FROM line_items WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Time entries
app.get('/api/time/:projectId', (req, res) => {
  res.json(db.prepare(`SELECT * FROM time_entries WHERE project_id=? ORDER BY started_at DESC`).all(req.params.projectId));
});

app.post('/api/time', (req, res) => {
  const { project_id, task_id, description, hours, started_at, ended_at } = req.body;
  const now = new Date().toISOString();
  const result = db.prepare(`INSERT INTO time_entries (project_id, task_id, description, hours, started_at, ended_at, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(project_id, task_id || null, description || null, hours || 0, started_at || now, ended_at || null, now);
  res.status(201).json(db.prepare(`SELECT * FROM time_entries WHERE id=?`).get(result.lastInsertRowid));
});

app.delete('/api/time/:id', (req, res) => {
  db.prepare(`DELETE FROM time_entries WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Assumptions
app.get('/api/assumptions/:projectId', (req, res) => {
  res.json(db.prepare(`SELECT * FROM assumptions WHERE project_id=? ORDER BY id`).all(req.params.projectId));
});

app.post('/api/assumptions', (req, res) => {
  const { project_id, text } = req.body;
  const result = db.prepare(`INSERT INTO assumptions (project_id, text) VALUES (?,?)`).run(project_id, text);
  res.status(201).json(db.prepare(`SELECT * FROM assumptions WHERE id=?`).get(result.lastInsertRowid));
});

app.delete('/api/assumptions/:id', (req, res) => {
  db.prepare(`DELETE FROM assumptions WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Project rates
app.get('/api/rates/:projectId', (req, res) => {
  res.json(db.prepare(`SELECT * FROM project_rates WHERE project_id=? ORDER BY role`).all(req.params.projectId));
});

app.put('/api/rates/:id', (req, res) => {
  const { hourly_rate } = req.body;
  db.prepare(`UPDATE project_rates SET hourly_rate=? WHERE id=?`).run(hourly_rate, req.params.id);
  res.json(db.prepare(`SELECT * FROM project_rates WHERE id=?`).get(req.params.id));
});

// Clients
app.get('/api/clients', (req, res) => {
  res.json(db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM projects p WHERE p.client = c.name) AS project_count,
      (SELECT COALESCE(SUM(p.budget),0) FROM projects p WHERE p.client = c.name) AS total_budget
    FROM clients c ORDER BY c.name
  `).all());
});

app.post('/api/clients', (req, res) => {
  const { name, email, phone, company } = req.body;
  if (!name) return res.status(400).json({ message: 'Nombre requerido' });
  const result = db.prepare(`INSERT INTO clients (name, email, phone, company, created_at) VALUES (?,?,?,?,?)`).run(name, email || null, phone || null, company || null, new Date().toISOString());
  res.status(201).json(db.prepare(`SELECT * FROM clients WHERE id=?`).get(result.lastInsertRowid));
});

app.put('/api/clients/:id', (req, res) => {
  const { name, email, phone, company } = req.body;
  db.prepare(`UPDATE clients SET name=COALESCE(?,name), email=COALESCE(?,email), phone=COALESCE(?,phone), company=COALESCE(?,company) WHERE id=?`).run(name, email, phone, company, req.params.id);
  res.json(db.prepare(`SELECT * FROM clients WHERE id=?`).get(req.params.id));
});

app.delete('/api/clients/:id', (req, res) => {
  db.prepare(`DELETE FROM clients WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Invoices
app.get('/api/invoices', (req, res) => {
  res.json(db.prepare(`
    SELECT i.*, p.name as project_name, p.client
    FROM invoices i LEFT JOIN projects p ON i.project_id = p.id
    ORDER BY i.id DESC
  `).all());
});

app.post('/api/invoices', (req, res) => {
  const { project_id, number, amount, status, due_date, notes } = req.body;
  const result = db.prepare(`INSERT INTO invoices (project_id, number, amount, status, due_date, notes, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(project_id, number, amount, status || 'draft', due_date || null, notes || null, new Date().toISOString());
  res.status(201).json(db.prepare(`SELECT * FROM invoices WHERE id=?`).get(result.lastInsertRowid));
});

app.put('/api/invoices/:id', (req, res) => {
  const { amount, status, due_date, notes, paid_date } = req.body;
  db.prepare(`UPDATE invoices SET amount=COALESCE(?,amount), status=COALESCE(?,status), due_date=COALESCE(?,due_date), notes=COALESCE(?,notes), paid_date=COALESCE(?,paid_date) WHERE id=?`).run(amount, status, due_date, notes, paid_date, req.params.id);
  res.json(db.prepare(`SELECT * FROM invoices WHERE id=?`).get(req.params.id));
});

app.delete('/api/invoices/:id', (req, res) => {
  db.prepare(`DELETE FROM invoices WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// Analytics: market rates reference
app.get('/api/market_rates', (req, res) => {
  // Static reference data for freelancer pricing benchmark by category
  const rates = [
    { category: 'Landing Page', low: 300, median: 800, high: 2500, unit: 'project' },
    { category: 'Sitio Web Corporativo', low: 800, median: 2500, high: 8000, unit: 'project' },
    { category: 'E-commerce', low: 1500, median: 5000, high: 20000, unit: 'project' },
    { category: 'Dashboard/Web App', low: 2000, median: 8000, high: 30000, unit: 'project' },
    { category: 'API Backend', low: 1000, median: 4000, high: 15000, unit: 'project' },
    { category: 'App Móvil', low: 3000, median: 12000, high: 50000, unit: 'project' },
    { category: 'Frontend Dev (hora)', low: 20, median: 45, high: 120, unit: 'hour' },
    { category: 'Backend Dev (hora)', low: 25, median: 50, high: 150, unit: 'hour' },
    { category: 'Fullstack Dev (hora)', low: 30, median: 55, high: 130, unit: 'hour' },
    { category: 'Diseño UX/UI (hora)', low: 20, median: 40, high: 90, unit: 'hour' },
    { category: 'Project Manager (hora)', low: 20, median: 35, high: 80, unit: 'hour' },
    { category: 'QA Testing (hora)', low: 15, median: 25, high: 50, unit: 'hour' },
    { category: 'Branding/Identidad', low: 500, median: 1500, high: 6000, unit: 'project' },
    { category: 'SEO Audit', low: 300, median: 800, high: 2500, unit: 'project' },
  ];
  res.json(rates);
});

// Analytics: dashboard data
app.get('/api/analytics', (req, res) => {
  const totalProjects = db.prepare(`SELECT COUNT(*) as c FROM projects`).get().c;
  const activeProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status='active'`).get().c;
  const completedProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status='completed'`).get().c;
  const totalBudget = db.prepare(`SELECT COALESCE(SUM(budget),0) as s FROM projects`).get().s;
  const totalLoggedHours = db.prepare(`SELECT COALESCE(SUM(hours),0) as s FROM time_entries`).get().s;
  const totalCost = db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM line_items`).get().s;
  const totalRevenue = db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM invoices WHERE status='paid'`).get().s;
  const pendingRevenue = db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM invoices WHERE status IN ('draft','sent')`).get().s;

  const projectsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM projects GROUP BY status
  `).all();

  const budgetByProject = db.prepare(`
    SELECT id, name, budget FROM projects ORDER BY budget DESC LIMIT 10
  `).all();

  const hoursByProject = db.prepare(`
    SELECT p.id, p.name, COALESCE(SUM(te.hours),0) as hours
    FROM projects p LEFT JOIN time_entries te ON te.project_id = p.id
    GROUP BY p.id ORDER BY hours DESC LIMIT 10
  `).all();

  const tasksByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `).all();

  const revenueTimeline = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(amount),0) as total
    FROM invoices WHERE status='paid'
    GROUP BY month ORDER BY month DESC LIMIT 12
  `).all();

  const costByCategory = db.prepare(`
    SELECT category, COALESCE(SUM(amount),0) as total FROM line_items GROUP BY category
  `).all();

  res.json({
    totalProjects, activeProjects, completedProjects,
    totalBudget, totalLoggedHours, totalCost,
    totalRevenue, pendingRevenue,
    projectsByStatus, budgetByProject,
    hoursByProject, tasksByStatus,
    revenueTimeline, costByCategory
  });
});

// ─── Activity log ────────────────────────────────────────────────
app.get('/api/activity', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const rows = db.prepare(`SELECT a.*, p.name as project_name FROM activity_log a LEFT JOIN projects p ON p.id = a.project_id ORDER BY a.id DESC LIMIT ?`).all(limit);
  res.json(rows);
});

app.get('/api/projects/:id/activity', (req, res) => {
  const rows = db.prepare(`SELECT a.*, p.name as project_name FROM activity_log a LEFT JOIN projects p ON p.id = a.project_id WHERE a.project_id = ? ORDER BY a.id DESC LIMIT 20`).all(req.params.id);
  res.json(rows);
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// ─── CSV Exports ─────────────────────────────────────────────────
function toCSV(columns, rows) {
  const escape = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n');
  return header + '\n' + body;
}

app.get('/api/projects/export/csv', (req, res) => {
  const rows = db.prepare(`SELECT id, name, client, budget, buffer_percent, currency, deadline, status FROM projects ORDER BY id DESC`).all();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=proyectos.csv');
  res.send(toCSV(['id','name','client','budget','buffer_percent','currency','deadline','status'], rows));
});

app.get('/api/projects/:id/tasks/export/csv', (req, res) => {
  const rows = db.prepare(`SELECT id, title, description, status, priority, estimated_hours, rate, category FROM tasks WHERE project_id=? ORDER BY id`).all(req.params.id);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=tareas-proyecto-${req.params.id}.csv`);
  res.send(toCSV(['id','title','description','status','priority','estimated_hours','rate','category'], rows));
});

app.get('/api/time/export/csv', (req, res) => {
  const rows = db.prepare(`SELECT t.id, p.name as project, t.description, t.hours, t.started_at, t.ended_at FROM time_entries t LEFT JOIN projects p ON p.id = t.project_id ORDER BY t.started_at DESC`).all();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=tiempo.csv');
  res.send(toCSV(['id','project','description','hours','started_at','ended_at'], rows));
});

app.get('/api/invoices/export/csv', (req, res) => {
  const rows = db.prepare(`SELECT i.id, p.name as project, i.number, i.amount, i.status, i.due_date, i.paid_date FROM invoices i LEFT JOIN projects p ON p.id = i.project_id ORDER BY i.id DESC`).all();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=facturas.csv');
  res.send(toCSV(['id','project','number','amount','status','due_date','paid_date'], rows));
});

// ─── Telegram settings ──────────────────────────────────────────
app.get('/api/settings/telegram', (req, res) => {
  res.json({
    enabled: notify.enabled(),
    chatId: process.env.TELEGRAM_CHAT_ID ? '••••••' : null,
  });
});

app.post('/api/settings/telegram', (req, res) => {
  const { test } = req.body;
  if (test) {
    notify.send('🧪 <b>Test de WorkApp</b>\n¡Las notificaciones funcionan! 🎉');
    return res.json({ ok: true, test: true });
  }
  res.json({ ok: false, message: 'Envía { test: true } para probar' });
});

const PORT = process.env.PORT || 3001;
bootstrap().then(async () => {
  await seedAdmin();
  app.listen(PORT, () => console.log(`WorkApp running on http://localhost:${PORT}`));
});