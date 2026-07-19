import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'workapp.db');

let _db = null;
let _persistTimer = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  client TEXT,
  budget REAL DEFAULT 0,
  buffer_percent REAL DEFAULT 20,
  currency TEXT DEFAULT 'USD',
  deadline TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  progress INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  position INTEGER DEFAULT 0,
  estimated_hours REAL DEFAULT 0,
  rate REAL DEFAULT 0,
  category TEXT DEFAULT 'dev',
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  stage_id INTEGER,
  description TEXT,
  hours REAL DEFAULT 0,
  rate REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  category TEXT DEFAULT 'dev'
);
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  task_id INTEGER,
  description TEXT,
  hours REAL DEFAULT 0,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS assumptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  text TEXT
);
CREATE TABLE IF NOT EXISTS project_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  role TEXT,
  hourly_rate REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  number TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  due_date TEXT,
  notes TEXT,
  paid_date TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  name TEXT,
  details TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  mime_type TEXT,
  path TEXT NOT NULL,
  created_at TEXT
);
`;

function persist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    if (!_db) return;
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }, 50);
}

// sql.js prepared-statement wrapper
// Creates fresh statement each call — sql.js stmts can't be safely cached after reset()
class Stmt {
  constructor(sql) {
    this.sql = sql;
  }

  all(...params) {
    const stmt = _db.prepare(this.sql);
    stmt.bind(params.map(v => v === undefined ? null : v));
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  get(...params) {
    const stmt = _db.prepare(this.sql);
    stmt.bind(params.map(v => v === undefined ? null : v));
    let result = undefined;
    if (stmt.step()) result = stmt.getAsObject();
    stmt.free();
    return result;
  }

  run(...params) {
    const stmt = _db.prepare(this.sql);
    stmt.bind(params.map(v => v === undefined ? null : v));
    stmt.step();
    stmt.free();
    persist();
    const r = _db.exec("SELECT last_insert_rowid() as id");
    const id = r.length ? r[0].values[0][0] : null;
    return { lastInsertRowid: id };
  }
}

export const db = {
  prepare(sql) { return new Stmt(sql); },
  exec(sql) { _db.run(sql); persist(); }
};

export async function bootstrap() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }
  _db.run(SCHEMA);
  // Flush immediately, not debounced
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('Database initialized at', DB_PATH);
}