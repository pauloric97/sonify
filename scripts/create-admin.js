import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { migrate, one, run } from '../server/db.js';
import { hashPassword } from '../server/auth.js';

migrate();

const rl = createInterface({ input: stdin, output: stdout });

const name = (await rl.question('Nome: ')).trim();
const email = (await rl.question('Email: ')).trim().toLowerCase();
const password = (await rl.question('Senha: ')).trim();
rl.close();

if (!name || !email || password.length < 6) {
  console.error('Faltou dado (senha precisa de 6+ caracteres).');
  process.exit(1);
}

if (one('SELECT id FROM users WHERE email = :email', { email })) {
  run('UPDATE users SET name = :name, password_hash = :hash, role = \'admin\' WHERE email = :email', {
    name,
    hash: hashPassword(password),
    email,
  });
  console.log('Conta já existia — senha atualizada e virou admin.');
} else {
  run(
    "INSERT INTO users (email, name, password_hash, role) VALUES (:email, :name, :hash, 'admin')",
    { email, name, hash: hashPassword(password) },
  );
  console.log('Admin criado.');
}
