import { Router } from 'express';
import { all, one, run } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { deleteObject } from '../storage.js';
import { buscarCandidatos, montarPatch } from '../enrich.js';
import { env } from '../env.js';

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

// Colunas que o front consome, já com favorito e progresso do usuário logado.
const MEDIA_FIELDS = `
  m.id, m.kind, m.title, m.artist, m.album, m.album_artist, m.genre, m.year,
  m.track_no, m.disc_no, m.series, m.season, m.episode, m.duration,
  m.cover, m.color, m.size, m.added_at,
  CASE WHEN f.media_id IS NULL THEN 0 ELSE 1 END AS favorite,
  COALESCE(pr.position, 0) AS position,
  COALESCE(pr.completed, 0) AS completed
`;

const MEDIA_JOINS = `
  FROM media m
  LEFT JOIN favorites f  ON f.media_id  = m.id AND f.user_id  = :uid
  LEFT JOIN progress  pr ON pr.media_id = m.id AND pr.user_id = :uid
`;

const mediaQuery = (where, order, extra = '') =>
  `SELECT ${MEDIA_FIELDS} ${MEDIA_JOINS} ${where ? `WHERE ${where}` : ''} ORDER BY ${order} ${extra}`;

const TRACK_ORDER = 'COALESCE(m.disc_no,1), COALESCE(m.track_no, 9999), m.title';

/* ------------------------------------------------------------------ home */

libraryRouter.get('/home', (req, res) => {
  const uid = req.user.id;

  const continueWatching = all(
    mediaQuery(
      'pr.position > 30 AND pr.completed = 0',
      'pr.updated_at DESC',
      'LIMIT 12',
    ),
    { uid },
  );

  const recent = all(
    `SELECT ${MEDIA_FIELDS}, MAX(pl.played_at) AS last_played
     ${MEDIA_JOINS}
     JOIN plays pl ON pl.media_id = m.id AND pl.user_id = :uid
     GROUP BY m.id
     ORDER BY last_played DESC
     LIMIT 12`,
    { uid },
  );

  const added = all(mediaQuery('', 'm.added_at DESC, m.id DESC', 'LIMIT 18'), { uid });

  const top = all(
    `SELECT ${MEDIA_FIELDS}, COUNT(pl.id) AS play_count
     ${MEDIA_JOINS}
     JOIN plays pl ON pl.media_id = m.id AND pl.user_id = :uid
     WHERE pl.played_at > datetime('now', '-90 days')
     GROUP BY m.id
     ORDER BY play_count DESC
     LIMIT 12`,
    { uid },
  );

  const counts = one(`
    SELECT
      (SELECT COUNT(*) FROM media WHERE kind = 'audio') AS tracks,
      (SELECT COUNT(*) FROM media WHERE kind = 'video') AS videos,
      (SELECT COUNT(DISTINCT COALESCE(album, '')) FROM media WHERE kind = 'audio') AS albums
  `);

  res.json({ continue: continueWatching, recent, added, top, counts });
});

/* ---------------------------------------------------------------- áudio */

libraryRouter.get('/tracks', (req, res) => {
  const uid = req.user.id;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const offset = Number(req.query.offset) || 0;
  res.json({
    tracks: all(mediaQuery("m.kind = 'audio'", 'm.title COLLATE NOCASE', 'LIMIT :limit OFFSET :offset'), {
      uid,
      limit,
      offset,
    }),
  });
});

libraryRouter.get('/albums', (req, res) => {
  res.json({
    albums: all(`
      SELECT COALESCE(NULLIF(TRIM(album), ''), 'Sem álbum') AS album,
             COALESCE(NULLIF(TRIM(album_artist), ''), NULLIF(TRIM(artist), ''), 'Artista desconhecido') AS artist,
             COUNT(*) AS tracks,
             MAX(cover) AS cover,
             MAX(color) AS color,
             MAX(year)  AS year,
             MAX(added_at) AS added_at
      FROM media WHERE kind = 'audio'
      GROUP BY 1, 2
      ORDER BY 1 COLLATE NOCASE
    `),
  });
});

libraryRouter.get('/album', (req, res) => {
  const uid = req.user.id;
  const album = String(req.query.album || '');
  const artist = String(req.query.artist || '');
  const tracks = all(
    mediaQuery(
      `m.kind = 'audio'
       AND COALESCE(NULLIF(TRIM(m.album), ''), 'Sem álbum') = :album
       AND COALESCE(NULLIF(TRIM(m.album_artist), ''), NULLIF(TRIM(m.artist), ''), 'Artista desconhecido') = :artist`,
      TRACK_ORDER,
    ),
    { uid, album, artist },
  );
  if (!tracks.length) return res.status(404).json({ error: 'Álbum não encontrado' });
  res.json({
    album: {
      album,
      artist,
      cover: tracks.find((t) => t.cover)?.cover || null,
      color: tracks[0].color,
      year: tracks.find((t) => t.year)?.year || null,
      tracks: tracks.length,
      duration: tracks.reduce((s, t) => s + (t.duration || 0), 0),
    },
    tracks,
  });
});

libraryRouter.get('/artists', (req, res) => {
  res.json({
    artists: all(`
      SELECT COALESCE(NULLIF(TRIM(artist), ''), 'Artista desconhecido') AS name,
             COUNT(*) AS tracks,
             COUNT(DISTINCT album) AS albums,
             MAX(cover) AS cover,
             MAX(color) AS color
      FROM media WHERE kind = 'audio'
      GROUP BY 1
      ORDER BY 1 COLLATE NOCASE
    `),
  });
});

libraryRouter.get('/artist', (req, res) => {
  const uid = req.user.id;
  const name = String(req.query.name || '');
  const tracks = all(
    mediaQuery(
      `m.kind = 'audio' AND COALESCE(NULLIF(TRIM(m.artist), ''), 'Artista desconhecido') = :name`,
      'm.year DESC, m.album, ' + TRACK_ORDER,
    ),
    { uid, name },
  );
  if (!tracks.length) return res.status(404).json({ error: 'Artista não encontrado' });

  const albums = [];
  for (const t of tracks) {
    const key = t.album || 'Sem álbum';
    let a = albums.find((x) => x.album === key);
    if (!a) {
      a = { album: key, artist: t.album_artist || name, cover: null, color: t.color, year: t.year, tracks: 0 };
      albums.push(a);
    }
    a.tracks++;
    if (!a.cover && t.cover) a.cover = t.cover;
  }

  res.json({ artist: { name, tracks: tracks.length, color: tracks[0].color }, albums, tracks });
});

/* ---------------------------------------------------------------- vídeo */

libraryRouter.get('/videos', (req, res) => {
  const uid = req.user.id;
  const series = all(`
    SELECT series AS name, COUNT(*) AS episodes,
           MAX(cover) AS cover, MAX(color) AS color, MAX(added_at) AS added_at
    FROM media
    WHERE kind = 'video' AND series IS NOT NULL AND TRIM(series) <> ''
    GROUP BY 1
    ORDER BY 1 COLLATE NOCASE
  `);
  const movies = all(
    mediaQuery("m.kind = 'video' AND (m.series IS NULL OR TRIM(m.series) = '')", 'm.added_at DESC'),
    { uid },
  );
  res.json({ series, movies });
});

libraryRouter.get('/series', (req, res) => {
  const uid = req.user.id;
  const name = String(req.query.name || '');
  const episodes = all(
    mediaQuery("m.kind = 'video' AND m.series = :name", 'COALESCE(m.season,1), COALESCE(m.episode,0), m.title'),
    { uid, name },
  );
  if (!episodes.length) return res.status(404).json({ error: 'Série não encontrada' });
  res.json({
    series: {
      name,
      episodes: episodes.length,
      cover: episodes.find((e) => e.cover)?.cover || null,
      color: episodes[0].color,
    },
    episodes,
  });
});

/* --------------------------------------------------------------- busca */

libraryRouter.get('/search', (req, res) => {
  const uid = req.user.id;
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ media: [], albums: [], artists: [] });
  const like = `%${q.toLowerCase()}%`;

  const media = all(
    mediaQuery(
      `LOWER(m.title) LIKE :like OR LOWER(COALESCE(m.artist,'')) LIKE :like
       OR LOWER(COALESCE(m.album,'')) LIKE :like OR LOWER(COALESCE(m.series,'')) LIKE :like`,
      `CASE WHEN LOWER(m.title) LIKE :like THEN 0 ELSE 1 END, m.title COLLATE NOCASE`,
      'LIMIT 60',
    ),
    { uid, like },
  );

  const albums = all(
    `SELECT COALESCE(NULLIF(TRIM(album), ''), 'Sem álbum') AS album,
            COALESCE(NULLIF(TRIM(album_artist), ''), NULLIF(TRIM(artist), ''), 'Artista desconhecido') AS artist,
            COUNT(*) AS tracks, MAX(cover) AS cover, MAX(color) AS color
     FROM media
     WHERE kind = 'audio' AND LOWER(COALESCE(album, '')) LIKE :like
     GROUP BY 1, 2 LIMIT 12`,
    { like },
  );

  const artists = all(
    `SELECT COALESCE(NULLIF(TRIM(artist), ''), 'Artista desconhecido') AS name,
            COUNT(*) AS tracks, MAX(cover) AS cover, MAX(color) AS color
     FROM media
     WHERE kind = 'audio' AND LOWER(COALESCE(artist, '')) LIKE :like
     GROUP BY 1 LIMIT 12`,
    { like },
  );

  res.json({ media, albums, artists });
});

/* -------------------------------------------------------- item avulso */

libraryRouter.get('/media/:id', (req, res) => {
  const row = one(mediaQuery('m.id = :id', 'm.id'), { uid: req.user.id, id: Number(req.params.id) });
  if (!row) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ media: row });
});

const EDITABLE = [
  'title', 'artist', 'album', 'album_artist', 'genre',
  'year', 'track_no', 'disc_no', 'series', 'season', 'episode',
];

libraryRouter.patch('/media/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM media WHERE id = :id', { id }))
    return res.status(404).json({ error: 'Não encontrado' });

  const fields = EDITABLE.filter((k) => k in (req.body || {}));
  if (fields.length) {
    const params = { id };
    for (const k of fields) {
      const v = req.body[k];
      params[k] = v === '' || v === null || v === undefined ? null : v;
    }
    run(`UPDATE media SET ${fields.map((k) => `${k} = :${k}`).join(', ')} WHERE id = :id`, params);
  }

  res.json({ media: one(mediaQuery('m.id = :id', 'm.id'), { uid: req.user.id, id }) });
});

/**
 * Conserta a duração de arquivo com header ruim: quem realmente sabe o tamanho
 * da faixa é o player, depois de carregar. Só preenche quando está faltando.
 */
libraryRouter.post('/media/:id/duracao', (req, res) => {
  const id = Number(req.params.id);
  const duration = Number(req.body?.duration);
  if (!Number.isFinite(duration) || duration <= 0)
    return res.status(400).json({ error: 'duração inválida' });

  const media = one('SELECT duration FROM media WHERE id = :id', { id });
  if (!media) return res.status(404).json({ error: 'Não encontrado' });
  if (media.duration) return res.json({ ok: true, mantido: true });

  run('UPDATE media SET duration = :duration WHERE id = :id', { id, duration });
  res.json({ ok: true, duration });
});

/* ------------------------------------------------- capa e dados por API */

/** Lista o que iTunes/Deezer/TMDB acharam pra esse item, pro admin escolher. */
libraryRouter.get('/media/:id/sugestoes', requireAdmin, async (req, res) => {
  const media = one('SELECT * FROM media WHERE id = :id', { id: Number(req.params.id) });
  if (!media) return res.status(404).json({ error: 'Não encontrado' });

  // O admin pode redigitar a busca quando o nome do arquivo é ruim.
  const termo = String(req.query.q || '').trim();
  const alvo = termo
    ? media.kind === 'video'
      ? { ...media, title: termo, series: media.series ? termo : null }
      : { ...media, title: termo, artist: null, album: null }
    : media;

  try {
    const candidatos = await buscarCandidatos(alvo);
    res.json({
      candidatos,
      aviso:
        media.kind === 'video' && !env.tmdbKey
          ? 'Sem TMDB_API_KEY no .env — busca de vídeo desligada.'
          : null,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/** Aplica o candidato escolhido. Aqui sobrescreve mesmo — foi o admin que mandou. */
libraryRouter.post('/media/:id/aplicar', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const media = one('SELECT * FROM media WHERE id = :id', { id });
  if (!media) return res.status(404).json({ error: 'Não encontrado' });

  const candidato = req.body?.candidato;
  if (!candidato) return res.status(400).json({ error: 'candidato obrigatório' });

  try {
    const patch = await montarPatch(media, candidato, { somenteVazios: false });
    const campos = Object.keys(patch);
    if (campos.length)
      run(`UPDATE media SET ${campos.map((k) => `${k} = :${k}`).join(', ')} WHERE id = :id`, {
        ...patch,
        id,
      });
    res.json({ media: one(mediaQuery('m.id = :id', 'm.id'), { uid: req.user.id, id }), aplicados: campos });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

libraryRouter.delete('/media/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const media = one('SELECT * FROM media WHERE id = :id', { id });
  if (!media) return res.status(404).json({ error: 'Não encontrado' });

  // ?purge=1 apaga também o arquivo lá no bucket.
  if (req.query.purge === '1') {
    try {
      await deleteObject(media.storage_key);
    } catch (err) {
      return res.status(502).json({ error: `Não deu pra apagar no bucket: ${err.message}` });
    }
  }
  run('DELETE FROM media WHERE id = :id', { id });
  res.json({ ok: true });
});
