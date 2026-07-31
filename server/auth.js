import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from './env.js';
import { one } from './db.js';

const TOKEN_TTL = '60d'; // app pessoal: sessão longa pra não ficar relogando no celular

export const hashPassword = (senha) => bcrypt.hashSync(senha, 10);
export const checkPassword = (senha, hash) => bcrypt.compareSync(senha, hash);

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

export const publicUser = (u) =>
  u && { id: u.id, email: u.email, name: u.name, role: u.role, accent: u.accent };

function readToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  // Tags <audio>/<video> não mandam header, então o stream aceita ?t=
  if (typeof req.query?.t === 'string') return req.query.t;
  return null;
}

export function requireAuth(req, res, next) {
  const token = readToken(req);
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Não autenticado' });

  const user = one('SELECT * FROM users WHERE id = :id', { id: payload.sub });
  if (!user) return res.status(401).json({ error: 'Usuário não existe mais' });

  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Só admin' });
  next();
}
