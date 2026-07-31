import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { coversDir, env } from './env.js';

const TIMEOUT = 9000;
const UA = 'Sonify/0.1 (biblioteca pessoal)';

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} respondeu ${res.status}`);
  return res.json();
}

/** Baixa uma capa e guarda em DATA_DIR/covers com o nome = hash do conteúdo. */
export async function salvarCapaDaUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return null; // placeholder/erro disfarçado
    const ext = res.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
    const nome = `${createHash('sha1').update(buf).digest('hex').slice(0, 16)}.${ext}`;
    const destino = path.join(coversDir, nome);
    if (!existsSync(destino)) writeFileSync(destino, buf);
    return nome;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- música */

// A capa do iTunes vem em 100x100; a URL aceita qualquer tamanho no lugar disso.
const capaGrande = (url) => url?.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/600x600bb.$1') || null;

async function iTunes({ title, artist, album }) {
  const termo = [artist, album, title].filter(Boolean).join(' ').trim();
  if (!termo) return [];

  const buscar = async (pais) => {
    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(termo)}` +
      `&entity=song&limit=5&country=${pais}`;
    return (await getJson(url)).results || [];
  };

  let results = await buscar('BR');
  if (!results.length) results = await buscar('US');

  return results.map((r) => ({
    fonte: 'iTunes',
    title: r.trackName || null,
    artist: r.artistName || null,
    album: r.collectionName || null,
    album_artist: r.collectionArtistName || r.artistName || null,
    year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null,
    track_no: r.trackNumber || null,
    disc_no: r.discNumber || null,
    genre: r.primaryGenreName || null,
    coverUrl: capaGrande(r.artworkUrl100),
    thumb: r.artworkUrl100 || null,
  }));
}

async function deezer({ title, artist, album }) {
  const termo = [artist, album, title].filter(Boolean).join(' ').trim();
  if (!termo) return [];
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(termo)}&limit=5`;
  const data = await getJson(url);
  return (data.data || []).map((r) => ({
    fonte: 'Deezer',
    title: r.title || null,
    artist: r.artist?.name || null,
    album: r.album?.title || null,
    album_artist: r.artist?.name || null,
    year: null,
    track_no: null,
    disc_no: null,
    genre: null,
    coverUrl: r.album?.cover_xl || r.album?.cover_big || null,
    thumb: r.album?.cover_small || null,
  }));
}

/** Candidatos pra uma faixa: iTunes primeiro (dado melhor), Deezer como reserva. */
export async function buscarMusica(alvo) {
  const listas = [];
  for (const provider of [iTunes, deezer]) {
    try {
      const r = await provider(alvo);
      if (r.length) listas.push(...r);
      if (listas.length >= 5) break;
    } catch {
      // provider fora do ar não pode derrubar a busca
    }
  }
  return listas.slice(0, 8);
}

/* ---------------------------------------------------------------- vídeo */

const IMG = (p, tam = 'w780') => (p ? `https://image.tmdb.org/t/p/${tam}${p}` : null);
const tmdbUrl = (caminho, params = {}) => {
  const q = new URLSearchParams({ api_key: env.tmdbKey, language: 'pt-BR', ...params });
  return `https://api.themoviedb.org/3/${caminho}?${q}`;
};

async function episodio(tvId, season, episode) {
  try {
    return await getJson(tmdbUrl(`tv/${tvId}/season/${season}/episode/${episode}`));
  } catch {
    return null;
  }
}

/** Candidatos pra um vídeo. Série resolve o episódio; filme usa o backdrop (16:9). */
export async function buscarVideo({ title, series, season, episode, year }) {
  if (!env.tmdbKey) return [];

  if (series) {
    const busca = await getJson(tmdbUrl('search/tv', { query: series }));
    const shows = (busca.results || []).slice(0, 5);
    const candidatos = [];

    for (const [i, show] of shows.entries()) {
      // Só vale a pena buscar o episódio dos primeiros — cada um é uma request.
      const ep = i < 3 && season && episode ? await episodio(show.id, season, episode) : null;
      candidatos.push({
        fonte: 'TMDB',
        title: ep?.name || title || null,
        series: show.name || series,
        season: season ?? null,
        episode: episode ?? null,
        year: (ep?.air_date || show.first_air_date || '').slice(0, 4)
          ? Number((ep?.air_date || show.first_air_date).slice(0, 4))
          : null,
        coverUrl: IMG(ep?.still_path) || IMG(show.backdrop_path) || IMG(show.poster_path, 'w500'),
        thumb: IMG(ep?.still_path, 'w185') || IMG(show.poster_path, 'w185'),
        subtitulo: ep ? `${show.name} • T${season}E${episode}` : show.name,
      });
    }
    return candidatos;
  }

  const busca = await getJson(
    tmdbUrl('search/movie', { query: title, ...(year ? { year: String(year) } : {}) }),
  );
  return (busca.results || []).slice(0, 5).map((f) => ({
    fonte: 'TMDB',
    title: f.title || null,
    series: null,
    season: null,
    episode: null,
    year: f.release_date ? Number(f.release_date.slice(0, 4)) : null,
    coverUrl: IMG(f.backdrop_path) || IMG(f.poster_path, 'w500'),
    thumb: IMG(f.poster_path, 'w185'),
    subtitulo: [f.release_date?.slice(0, 4), f.original_title].filter(Boolean).join(' • '),
  }));
}

export const buscarCandidatos = (media) =>
  media.kind === 'video'
    ? buscarVideo({
        title: media.title,
        series: media.series,
        season: media.season,
        episode: media.episode,
        year: media.year,
      })
    : buscarMusica({ title: media.title, artist: media.artist, album: media.album });

const CAMPOS = [
  'title', 'artist', 'album', 'album_artist', 'genre',
  'year', 'track_no', 'disc_no', 'series', 'season', 'episode',
];

/**
 * Monta o patch a partir de um candidato.
 * `somenteVazios` protege o que veio na tag do arquivo — usado no ingest automático.
 */
export async function montarPatch(media, candidato, { somenteVazios = true } = {}) {
  const patch = {};
  for (const campo of CAMPOS) {
    const novo = candidato[campo];
    if (novo === undefined || novo === null || novo === '') continue;
    if (somenteVazios && media[campo] !== null && media[campo] !== undefined && media[campo] !== '')
      continue;
    patch[campo] = novo;
  }

  if (candidato.coverUrl && (!somenteVazios || !media.cover)) {
    const cover = await salvarCapaDaUrl(candidato.coverUrl);
    if (cover) patch.cover = cover;
  }
  return patch;
}
