import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

const file = path.join(env.dataDir, 'sonify.db');

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  const schema = readFileSync(path.resolve(process.cwd(), 'schema.sql'), 'utf8');
  db.exec(schema);
}

// Helpers curtinhos, no estilo do resto do código.
export const one = (sql, params = {}) => db.prepare(sql).get(params);
export const all = (sql, params = {}) => db.prepare(sql).all(params);
export const run = (sql, params = {}) => db.prepare(sql).run(params);
