import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { one, run } from '../db.js';
import {
  checkPassword,
  hashPassword,
  publicUser,
  requireAuth,
  signToken,
} from '../auth.js';

export const authRouter = Router();

const loginLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas, espera uns minutos' },
});

const countUsers = () => one('SELECT COUNT(*) AS n FROM users').n;

/** O front usa isso pra saber se mostra o login ou a tela de "criar primeiro acesso". */
authRouter.get('/status', (req, res) => {
  res.json({ needsSetup: countUsers() === 0 });
});

/** Só funciona enquanto não existe nenhum usuário: cria o admin dono da instância. */
authRouter.post('/setup', loginLimit, (req, res) => {
  if (countUsers() > 0) return res.status(409).json({ error: 'Já existe conta criada' });

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltou algum campo' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'Senha muito curta (mínimo 6)' });

  const info = run(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES (:email, :name, :hash, 'admin')`,
    { email: String(email).toLowerCase().trim(), name: String(name).trim(), hash: hashPassword(password) },
  );
  const user = one('SELECT * FROM users WHERE id = :id', { id: info.lastInsertRowid });
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.post('/login', loginLimit, (req, res) => {
  const { email, password } = req.body || {};
  const user = one('SELECT * FROM users WHERE email = :email', {
    email: String(email || '').toLowerCase().trim(),
  });
  if (!user || !checkPassword(String(password || ''), user.password_hash))
    return res.status(401).json({ error: 'Email ou senha errados' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

authRouter.patch('/me', requireAuth, (req, res) => {
  const { name, accent, password, currentPassword } = req.body || {};

  if (password) {
    if (!checkPassword(String(currentPassword || ''), req.user.password_hash))
      return res.status(403).json({ error: 'Senha atual não confere' });
    if (String(password).length < 6)
      return res.status(400).json({ error: 'Senha muito curta (mínimo 6)' });
    run('UPDATE users SET password_hash = :hash WHERE id = :id', {
      hash: hashPassword(password),
      id: req.user.id,
    });
  }
  if (name) run('UPDATE users SET name = :name WHERE id = :id', { name: String(name).trim(), id: req.user.id });
  if (accent) run('UPDATE users SET accent = :accent WHERE id = :id', { accent: String(accent), id: req.user.id });

  const user = one('SELECT * FROM users WHERE id = :id', { id: req.user.id });
  res.json({ user: publicUser(user) });
});
