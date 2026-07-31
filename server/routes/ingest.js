import { Router } from 'express';
import { all, one, run } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { buildKey, listAll, presignPut, putStream, storageConfigured } from '../storage.js';
import { extractMetadata, kindOf, mimeFor } from '../metadata.js';
import { completarComApi, insertMedia } from '../ingestir.js';

export const ingestRouter = Router();

// Guard por rota (e não router.use) pra não sequestrar o 404 das outras rotas /api.
const soAdmin = [requireAuth, requireAdmin];

/* ------------------------------------------------------------- upload */

/** Passo 1: o front pede uma URL e sobe o arquivo direto pro bucket. */
ingestRouter.post('/upload/presign', soAdmin, async (req, res) => {
  if (!storageConfigured) return res.status(503).json({ error: 'Storage não configurado no .env' });

  const { filename, size } = req.body || {};
  if (!filename) return res.status(400).json({ error: 'filename obrigatório' });

  const kind = kindOf(filename);
  if (!kind) return res.status(400).json({ error: 'Formato não suportado' });

  const key = buildKey(kind, filename);
  const contentType = mimeFor(filename);
  try {
    const url = await presignPut(key, contentType);
    res.json({ key, url, contentType, kind, size: size ?? null });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * Plano B do passo 1: o arquivo sobe pelo servidor.
 * Serve pra quando o bucket não tem CORS liberado pro PUT — como é a mesma origem do app,
 * CORS nem entra na história. O corpo vai em stream, então arquivo grande não pesa na memória.
 */
ingestRouter.put('/upload/direct', soAdmin, async (req, res) => {
  if (!storageConfigured) return res.status(503).json({ error: 'Storage não configurado no .env' });

  const key = String(req.query.key || '');
  if (!key) return res.status(400).json({ error: 'key obrigatória' });
  if (!kindOf(key)) return res.status(400).json({ error: 'Formato não suportado' });

  const length = Number(req.headers['content-length']);
  if (!length) return res.status(411).json({ error: 'Content-Length obrigatório' });

  try {
    await putStream(key, req, req.headers['content-type'] || mimeFor(key), length);
    res.json({ ok: true, key });
  } catch (err) {
    res.status(502).json({ error: `Falha ao gravar no bucket: ${err.message}` });
  }
});

/** Passo 2: terminou o upload — o servidor lê as tags e cadastra na biblioteca. */
ingestRouter.post('/upload/complete', soAdmin, async (req, res) => {
  const { key, filename, size, duration } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key obrigatória' });
  if (one('SELECT id FROM media WHERE storage_key = :key', { key }))
    return res.status(409).json({ error: 'Esse arquivo já está na biblioteca' });

  const kind = kindOf(filename || key);
  if (!kind) return res.status(400).json({ error: 'Formato não suportado' });

  try {
    const meta = await extractMetadata({
      key,
      filename: filename || key.split('/').pop(),
      size: Number(size) || null,
      kind,
      durationHint: Number(duration) || null,
    });
    res.json({ media: insertMedia(await completarComApi(meta), key, req.user.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------------------- scan */

// Estado do scan em memória: é um job só, roda de vez em quando.
let job = { running: false, total: 0, done: 0, added: 0, skipped: 0, errors: [], startedAt: null, finishedAt: null };

async function runScan(userId) {
  job = { running: true, total: 0, done: 0, added: 0, skipped: 0, errors: [], startedAt: new Date().toISOString(), finishedAt: null };
  try {
    const objects = await listAll();
    const known = new Set(all('SELECT storage_key FROM media').map((r) => r.storage_key));
    const pending = objects.filter((o) => kindOf(o.key) && !known.has(o.key));

    job.total = pending.length;
    job.skipped = objects.length - pending.length;

    for (const obj of pending) {
      try {
        const meta = await extractMetadata({
          key: obj.key,
          filename: obj.key.split('/').pop(),
          size: obj.size,
          kind: kindOf(obj.key),
        });
        insertMedia(await completarComApi(meta), obj.key, userId);
        job.added++;
      } catch (err) {
        job.errors.push({ key: obj.key, error: err.message });
      }
      job.done++;
    }
  } catch (err) {
    job.errors.push({ key: '*', error: err.message });
  } finally {
    job.running = false;
    job.finishedAt = new Date().toISOString();
  }
}

/** Varre o bucket e importa tudo que ainda não está na biblioteca. Roda em background. */
ingestRouter.post('/scan', soAdmin, (req, res) => {
  if (!storageConfigured) return res.status(503).json({ error: 'Storage não configurado no .env' });
  if (job.running) return res.status(409).json({ error: 'Já tem um scan rodando', job });
  runScan(req.user.id);
  res.json({ ok: true, job });
});

ingestRouter.get('/scan/status', soAdmin, (req, res) => res.json({ job }));

/** Remove da biblioteca o que não existe mais no bucket (arquivo apagado por fora). */
ingestRouter.post('/scan/prune', soAdmin, async (req, res) => {
  if (!storageConfigured) return res.status(503).json({ error: 'Storage não configurado no .env' });
  try {
    const objects = new Set((await listAll()).map((o) => o.key));
    const rows = all('SELECT id, storage_key FROM media');
    const gone = rows.filter((r) => !objects.has(r.storage_key));
    for (const r of gone) run('DELETE FROM media WHERE id = :id', { id: r.id });
    res.json({ removed: gone.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
