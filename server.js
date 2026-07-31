import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { existsSync } from 'node:fs';

import { coversDir, env } from './server/env.js';
import { migrate, one } from './server/db.js';
import { authRouter } from './server/routes/auth.js';
import { usersRouter } from './server/routes/users.js';
import { libraryRouter } from './server/routes/library.js';
import { playbackRouter } from './server/routes/playback.js';
import { playlistsRouter } from './server/routes/playlists.js';
import { ingestRouter } from './server/routes/ingest.js';
import { torrentsRouter } from './server/routes/torrents.js';
import { catalogoRouter } from './server/routes/catalogo.js';
import { configRouter } from './server/routes/config.js';
import { iniciarWorkerTorrents } from './server/torrent-worker.js';

migrate();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    // O app é uma SPA servida pelo mesmo host; CSP restritiva aqui só atrapalha
    // (o player carrega mídia de URLs assinadas do bucket).
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(express.json({ limit: '1mb' }));

/* -------------------------------------------------------------- rotas */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, users: one('SELECT COUNT(*) AS n FROM users').n });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/library', libraryRouter);
app.use('/api', playbackRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/torrents', torrentsRouter);
app.use('/api/catalogo', catalogoRouter);
app.use('/api/config', configRouter);
app.use('/api', ingestRouter);

// Capas extraídas das tags. Imutáveis (nome = hash do conteúdo).
app.use(
  '/covers',
  express.static(coversDir, {
    maxAge: '365d',
    immutable: true,
    fallthrough: true,
  }),
);

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

/* ---------------------------------------------------------------- SPA */

const dist = path.resolve(process.cwd(), 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '7d' }));
  app.use((req, res) => {
    // Service worker e manifest não podem ficar em cache longo.
    res.sendFile(path.join(dist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
  });
} else {
  app.use((req, res) => {
    res.status(200).send(
      '<pre style="font:14px monospace;padding:24px">Front ainda não foi buildado.\n\n' +
        'Dev:  npm run dev   (front em http://localhost:5173)\n' +
        'Prod: npm run build && npm start</pre>',
    );
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

const server = app.listen(env.port, () => {
  console.log(`\n  Sonify rodando em http://localhost:${env.port}`);
  console.log(`  Banco: ${path.join(env.dataDir, 'sonify.db')}\n`);
});

// Upload de filme de 2 GB não pode morrer nos 5 min padrão do Node.
server.requestTimeout = 0;
server.headersTimeout = 60_000;

iniciarWorkerTorrents();
