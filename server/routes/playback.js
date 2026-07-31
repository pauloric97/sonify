import { Router } from 'express';
import { all, one, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { presignGet } from '../storage.js';

export const playbackRouter = Router();

/**
 * Streaming: redireciona pra uma URL assinada do bucket.
 * O arquivo vai direto do R2/B2 pro player (com range requests, então seek funciona),
 * sem consumir banda do servidor. O token vem no ?t= porque <audio>/<video>
 * não mandam header Authorization.
 */
playbackRouter.get('/stream/:id', requireAuth, async (req, res) => {
  const media = one('SELECT * FROM media WHERE id = :id', { id: Number(req.params.id) });
  if (!media) return res.status(404).json({ error: 'Não encontrado' });

  try {
    const url = await presignGet(media.storage_key);
    res.set('Cache-Control', 'no-store');
    res.redirect(302, url);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

/** Mesma coisa, mas em JSON — útil pra pré-carregar a próxima faixa da fila. */
playbackRouter.get('/stream/:id/url', requireAuth, async (req, res) => {
  const media = one('SELECT storage_key FROM media WHERE id = :id', { id: Number(req.params.id) });
  if (!media) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ url: await presignGet(media.storage_key) });
});

/* ----------------------------------------------------------- favoritos */

playbackRouter.get('/favorites', requireAuth, (req, res) => {
  const rows = all(
    `SELECT m.*, 1 AS favorite, COALESCE(pr.position, 0) AS position
     FROM favorites f
     JOIN media m ON m.id = f.media_id
     LEFT JOIN progress pr ON pr.media_id = m.id AND pr.user_id = :uid
     WHERE f.user_id = :uid
     ORDER BY f.created_at DESC`,
    { uid: req.user.id },
  );
  res.json({ media: rows });
});

playbackRouter.post('/favorites/:mediaId', requireAuth, (req, res) => {
  const params = { uid: req.user.id, mid: Number(req.params.mediaId) };
  const exists = one('SELECT 1 AS x FROM favorites WHERE user_id = :uid AND media_id = :mid', params);
  if (exists) {
    run('DELETE FROM favorites WHERE user_id = :uid AND media_id = :mid', params);
    return res.json({ favorite: false });
  }
  run('INSERT INTO favorites (user_id, media_id) VALUES (:uid, :mid)', params);
  res.json({ favorite: true });
});

/* ------------------------------------------------------------ progresso */

playbackRouter.post('/progress', requireAuth, (req, res) => {
  const { mediaId, position, duration } = req.body || {};
  if (!mediaId) return res.status(400).json({ error: 'mediaId obrigatório' });

  const pos = Math.max(0, Number(position) || 0);
  const dur = Number(duration) || null;
  // Passou de 95%? Considera assistido e some do "continuar assistindo".
  const completed = dur && pos / dur > 0.95 ? 1 : 0;

  run(
    `INSERT INTO progress (user_id, media_id, position, duration, completed, updated_at)
     VALUES (:uid, :mid, :pos, :dur, :done, datetime('now'))
     ON CONFLICT(user_id, media_id) DO UPDATE SET
       position = :pos, duration = COALESCE(:dur, duration),
       completed = :done, updated_at = datetime('now')`,
    { uid: req.user.id, mid: Number(mediaId), pos, dur, done: completed },
  );
  res.json({ ok: true });
});

/* -------------------------------------------------------------- plays */

playbackRouter.post('/plays', requireAuth, (req, res) => {
  const { mediaId, ms } = req.body || {};
  if (!mediaId) return res.status(400).json({ error: 'mediaId obrigatório' });
  run('INSERT INTO plays (user_id, media_id, ms_played) VALUES (:uid, :mid, :ms)', {
    uid: req.user.id,
    mid: Number(mediaId),
    ms: Math.round(Number(ms) || 0),
  });
  res.json({ ok: true });
});

playbackRouter.get('/history', requireAuth, (req, res) => {
  const rows = all(
    `SELECT m.*, MAX(p.played_at) AS last_played, COUNT(p.id) AS play_count
     FROM plays p JOIN media m ON m.id = p.media_id
     WHERE p.user_id = :uid
     GROUP BY m.id
     ORDER BY last_played DESC
     LIMIT 100`,
    { uid: req.user.id },
  );
  res.json({ media: rows });
});
