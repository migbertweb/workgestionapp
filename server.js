import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, bootstrap } from './db.js';
import { seedAdmin, requireAuth, authRoutes } from './auth.js';

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

app.post('/api/projects', (req, res) => {
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
  res.status(201).json(db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id));
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
  res.status(201).json(db.prepare(`SELECT * FROM tasks WHERE id=?`).get(result.lastInsertRowid));
});

app.put('/api/tasks/:id', (req, res) => {
  const { stage_id, title, description, status, priority, position, estimated_hours, rate, category } = req.body;
  const now = new Date().toISOString();
  db.prepare(`UPDATE tasks SET stage_id=COALESCE(?,stage_id), title=COALESCE(?,title), description=COALESCE(?,description), status=COALESCE(?,status), priority=COALESCE(?,priority), position=COALESCE(?,position), estimated_hours=COALESCE(?,estimated_hours), rate=COALESCE(?,rate), category=COALESCE(?,category), updated_at=? WHERE id=?`)
    .run(stage_id, title, description, status, priority, position, estimated_hours, rate, category, now, req.params.id);
  res.json(db.prepare(`SELECT * FROM tasks WHERE id=?`).get(req.params.id));
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

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientBuild, 'index.html'));
});

const PORT = process.env.PORT || 3001;
bootstrap().then(async () => {
  await seedAdmin();
  app.listen(PORT, () => console.log(`WorkApp running on http://localhost:${PORT}`));
});