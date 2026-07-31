import { Router } from 'express';
import { all, one, run } from '../db.js';
import { hashPassword, publicUser, requireAdmin, requireAuth } from '../auth.js';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

usersRouter.get('/', (req, res) => {
  const rows = all(`
    SELECT u.id, u.email, u.name, u.role, u.accent, u.created_at,
           (SELECT COUNT(*) FROM plays p WHERE p.user_id = u.id) AS plays
    FROM users u ORDER BY u.created_at
  `);
  res.json({ users: rows });
});

usersRouter.post('/', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltou algum campo' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Senha muito curta (mínimo 6)' });

  const mail = String(email).toLowerCase().trim();
  if (one('SELECT id FROM users WHERE email = :email', { email: mail }))
    return res.status(409).json({ error: 'Já existe conta com esse email' });

  const info = run(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES (:email, :name, :hash, :role)`,
    {
      email: mail,
      name: String(name).trim(),
      hash: hashPassword(password),
      role: role === 'admin' ? 'admin' : 'viewer',
    },
  );
  const user = one('SELECT * FROM users WHERE id = :id', { id: info.lastInsertRowid });
  res.json({ user: publicUser(user) });
});

usersRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = one('SELECT * FROM users WHERE id = :id', { id });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { name, role, password } = req.body || {};
  if (name) run('UPDATE users SET name = :name WHERE id = :id', { name: String(name).trim(), id });
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: 'Senha muito curta' });
    run('UPDATE users SET password_hash = :hash WHERE id = :id', { hash: hashPassword(password), id });
  }
  if (role && (role === 'admin' || role === 'viewer')) {
    // Não deixa remover o último admin e ficar sem ninguém pra subir conteúdo.
    const admins = one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").n;
    if (user.role === 'admin' && role === 'viewer' && admins <= 1)
      return res.status(400).json({ error: 'Precisa sobrar pelo menos um admin' });
    run('UPDATE users SET role = :role WHERE id = :id', { role, id });
  }

  res.json({ user: publicUser(one('SELECT * FROM users WHERE id = :id', { id })) });
});

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Não dá pra apagar sua própria conta' });
  run('DELETE FROM users WHERE id = :id', { id });
  res.json({ ok: true });
});
