import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'workapp-dev-secret-change-in-production';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const COOKIE_NAME = 'workapp_token';

// Seed default admin user on first boot
export async function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USER);
  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASS, 10);
    db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
      .run(ADMIN_USER, hash, new Date().toISOString());
    console.log(`Admin user created: ${ADMIN_USER} / ${ADMIN_PASS}`);
  }
}

// JWT verify middleware
export function requireAuth(req, res, next) {
  const token =
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) return res.status(401).json({ message: 'No autenticado' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// Optional auth: attaches user if token present, doesn't block
export function optionalAuth(req, res, next) {
  const token =
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.userId = payload.sub;
      req.username = payload.username;
    } catch { /* token invalid, ignore */ }
  }
  next();
}

// Register auth routes
export function authRoutes(app) {
  // POST /api/auth/register — create new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password || password.length < 4) {
        return res.status(400).json({ message: 'Usuario y contraseña (mín 4 chars) requeridos' });
      }
      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (exists) return res.status(409).json({ message: 'Usuario ya existe' });

      const hash = await bcrypt.hash(password, 10);
      db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
        .run(username, hash, new Date().toISOString());
      res.status(201).json({ message: 'Usuario creado' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
      }
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ message: 'Credenciales inválidas' });

      const token = jwt.sign(
        { sub: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ message: 'Sesión cerrada' });
  });

  // GET /api/auth/me — current user
  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ id: req.userId, username: req.username });
  });

  // PUT /api/auth/password — change password
  app.put('/api/auth/password', requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: 'Contraseña actual y nueva (mín 4 chars) requeridas' });
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return res.status(401).json({ message: 'Contraseña actual incorrecta' });

      const hash = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.userId);
      res.json({ message: 'Contraseña actualizada' });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });
}