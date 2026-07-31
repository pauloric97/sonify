import { Router } from 'express';
import { all, one, run } from '../db.js';
import { requireAuth } from '../auth.js';

export const playlistsRouter = Router();
playlistsRouter.use(requireAuth);

const listSql = `
  SELECT p.*, u.name AS owner,
         (SELECT COUNT(*) FROM playlist_items i WHERE i.playlist_id = p.id) AS items,
         (SELECT m.cover FROM playlist_items i JOIN media m ON m.id = i.media_id
           WHERE i.playlist_id = p.id AND m.cover IS NOT NULL
           ORDER BY i.position LIMIT 1) AS cover,
         (SELECT m.color FROM playlist_items i JOIN media m ON m.id = i.media_id
           WHERE i.playlist_id = p.id ORDER BY i.position LIMIT 1) AS color
  FROM playlists p
  JOIN users u ON u.id = p.user_id
`;

playlistsRouter.get('/', (req, res) => {
  res.json({
    playlists: all(`${listSql} WHERE p.user_id = :uid OR p.is_public = 1 ORDER BY p.created_at DESC`, {
      uid: req.user.id,
    }),
  });
});

playlistsRouter.post('/', (req, res) => {
  const { name, description, isPublic } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Dá um nome pra playlist' });
  const info = run(
    `INSERT INTO playlists (user_id, name, description, is_public)
     VALUES (:uid, :name, :desc, :pub)`,
    {
      uid: req.user.id,
      name: name.trim(),
      desc: description?.trim() || null,
      pub: isPublic === false ? 0 : 1,
    },
  );
  res.json({ playlist: one(`${listSql} WHERE p.id = :id`, { id: info.lastInsertRowid }) });
});

playlistsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const playlist = one(`${listSql} WHERE p.id = :id`, { id });
  if (!playlist) return res.status(404).json({ error: 'Playlist não encontrada' });
  if (!playlist.is_public && playlist.user_id !== req.user.id)
    return res.status(403).json({ error: 'Playlist privada' });

  const tracks = all(
    `SELECT m.*, i.position,
            CASE WHEN f.media_id IS NULL THEN 0 ELSE 1 END AS favorite
     FROM playlist_items i
     JOIN media m ON m.id = i.media_id
     LEFT JOIN favorites f ON f.media_id = m.id AND f.user_id = :uid
     WHERE i.playlist_id = :id
     ORDER BY i.position, i.added_at`,
    { id, uid: req.user.id },
  );
  res.json({ playlist, tracks });
});

function ownedOr403(req, res) {
  const playlist = one('SELECT * FROM playlists WHERE id = :id', { id: Number(req.params.id) });
  if (!playlist) {
    res.status(404).json({ error: 'Playlist não encontrada' });
    return null;
  }
  if (playlist.user_id !== req.user.id) {
    res.status(403).json({ error: 'Essa playlist é de outro perfil' });
    return null;
  }
  return playlist;
}

playlistsRouter.patch('/:id', (req, res) => {
  const playlist = ownedOr403(req, res);
  if (!playlist) return;
  const { name, description, isPublic } = req.body || {};
  run(
    `UPDATE playlists SET name = :name, description = :desc, is_public = :pub WHERE id = :id`,
    {
      id: playlist.id,
      name: name?.trim() || playlist.name,
      desc: description === undefined ? playlist.description : description?.trim() || null,
      pub: isPublic === undefined ? playlist.is_public : isPublic ? 1 : 0,
    },
  );
  res.json({ playlist: one(`${listSql} WHERE p.id = :id`, { id: playlist.id }) });
});

playlistsRouter.delete('/:id', (req, res) => {
  const playlist = ownedOr403(req, res);
  if (!playlist) return;
  run('DELETE FROM playlists WHERE id = :id', { id: playlist.id });
  res.json({ ok: true });
});

playlistsRouter.post('/:id/items', (req, res) => {
  const playlist = ownedOr403(req, res);
  if (!playlist) return;

  const ids = (Array.isArray(req.body?.mediaIds) ? req.body.mediaIds : [req.body?.mediaId])
    .map(Number)
    .filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Nada pra adicionar' });

  const next = one('SELECT COALESCE(MAX(position), 0) AS p FROM playlist_items WHERE playlist_id = :id', {
    id: playlist.id,
  }).p;

  ids.forEach((mediaId, i) => {
    run(
      `INSERT INTO playlist_items (playlist_id, media_id, position) VALUES (:pid, :mid, :pos)
       ON CONFLICT(playlist_id, media_id) DO NOTHING`,
      { pid: playlist.id, mid: mediaId, pos: next + i + 1 },
    );
  });
  res.json({ ok: true, added: ids.length });
});

playlistsRouter.delete('/:id/items/:mediaId', (req, res) => {
  const playlist = ownedOr403(req, res);
  if (!playlist) return;
  run('DELETE FROM playlist_items WHERE playlist_id = :pid AND media_id = :mid', {
    pid: playlist.id,
    mid: Number(req.params.mediaId),
  });
  res.json({ ok: true });
});

/** Reordena: recebe a lista completa de ids na ordem nova. */
playlistsRouter.put('/:id/order', (req, res) => {
  const playlist = ownedOr403(req, res);
  if (!playlist) return;
  const ids = (req.body?.mediaIds || []).map(Number).filter(Boolean);
  ids.forEach((mid, i) => {
    run('UPDATE playlist_items SET position = :pos WHERE playlist_id = :pid AND media_id = :mid', {
      pos: i + 1,
      pid: playlist.id,
      mid,
    });
  });
  res.json({ ok: true });
});
