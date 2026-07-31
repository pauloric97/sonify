import { env } from './env.js';

/**
 * Catálogo do "Explorar": o que está em alta lá fora, pra você achar o que baixar.
 * Música vem do Deezer e do RSS da Apple (sem chave). Filme e série vêm do TMDB.
 */

const TIMEOUT = 9000;
const UA = 'Sonify/0.1 (biblioteca pessoal)';
const PAIS = process.env.CATALOGO_PAIS || 'br';

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} respondeu ${res.status}`);
  return res.json();
}

/** Roda tudo em paralelo e ignora quem falhar — uma fonte fora do ar não derruba a tela. */
async function juntar(tarefas) {
  const resultados = await Promise.allSettled(tarefas.map((t) => t.fn()));
  return tarefas
    .map((t, i) => ({
      titulo: t.titulo,
      itens: resultados[i].status === 'fulfilled' ? resultados[i].value : [],
      erro: resultados[i].status === 'rejected' ? resultados[i].reason.message : null,
    }))
    .filter((s) => s.itens.length || s.erro);
}

/* --------------------------------------------------------------- música */

const albumDeezer = (a) => ({
  tipo: 'album',
  id: `deezer-album-${a.id}`,
  titulo: a.title,
  subtitulo: a.artist?.name || '',
  capa: a.cover_big || a.cover_medium || null,
  ano: a.release_date ? Number(String(a.release_date).slice(0, 4)) : null,
  busca: [a.artist?.name, a.title].filter(Boolean).join(' '),
});

const faixaDeezer = (t) => ({
  tipo: 'faixa',
  id: `deezer-track-${t.id}`,
  titulo: t.title,
  subtitulo: t.artist?.name || '',
  capa: t.album?.cover_big || t.album?.cover_medium || null,
  ano: null,
  busca: [t.artist?.name, t.title].filter(Boolean).join(' '),
});

async function deezerAlbuns(genero = 0, limite = 20) {
  const j = await getJson(`https://api.deezer.com/chart/${genero}/albums?limit=${limite}`);
  return (j.data || []).map(albumDeezer);
}

async function deezerFaixas(limite = 20) {
  const j = await getJson(`https://api.deezer.com/chart/0/tracks?limit=${limite}`);
  return (j.data || []).map(faixaDeezer);
}

/** RSS da Apple: os álbuns mais baixados do país. Bom pra "lançamentos". */
async function appleAlbuns(limite = 20) {
  const j = await getJson(`https://itunes.apple.com/${PAIS}/rss/topalbums/limit=${limite}/json`);
  return (j.feed?.entry || []).map((e) => ({
    tipo: 'album',
    id: `apple-${e.id?.attributes?.['im:id'] || e['im:name'].label}`,
    titulo: e['im:name'].label,
    subtitulo: e['im:artist'].label,
    // A arte vem em 170px; a URL aceita tamanho maior.
    capa: (e['im:image']?.at(-1)?.label || '').replace(/\/\d+x\d+bb\./, '/512x512bb.'),
    ano: e['im:releaseDate']?.label ? Number(e['im:releaseDate'].label.slice(0, 4)) : null,
    busca: `${e['im:artist'].label} ${e['im:name'].label}`,
  }));
}

/* ---------------------------------------------------------- filme/série */

const IMG = (p, tam = 'w500') => (p ? `https://image.tmdb.org/t/p/${tam}${p}` : null);

const tmdbUrl = (caminho, params = {}) => {
  const q = new URLSearchParams({ api_key: env.tmdbKey, language: 'pt-BR', ...params });
  return `https://api.themoviedb.org/3/${caminho}?${q}`;
};

function filmeTmdb(f) {
  const ano = (f.release_date || f.first_air_date || '').slice(0, 4);
  const ehSerie = Boolean(f.first_air_date || f.name);
  const titulo = f.title || f.name;
  return {
    tipo: ehSerie ? 'serie' : 'filme',
    id: `tmdb-${ehSerie ? 'tv' : 'movie'}-${f.id}`,
    titulo,
    subtitulo: [ano, f.original_title !== titulo ? f.original_title : null].filter(Boolean).join(' • '),
    capa: IMG(f.poster_path),
    backdrop: IMG(f.backdrop_path, 'w780'),
    ano: ano ? Number(ano) : null,
    nota: f.vote_average ? Math.round(f.vote_average * 10) / 10 : null,
    sinopse: f.overview || null,
    // Filme rende busca melhor com o ano junto; série, não.
    busca: ehSerie ? titulo : [titulo, ano].filter(Boolean).join(' '),
  };
}

async function tmdbLista(caminho, params = {}) {
  if (!env.tmdbKey) throw new Error('Sem TMDB_API_KEY no .env');
  const j = await getJson(tmdbUrl(caminho, params));
  return (j.results || []).filter((r) => r.media_type !== 'person').map(filmeTmdb);
}

/* --------------------------------------------------------------- fachada */

export async function destaques() {
  const [musica, video] = await Promise.all([
    juntar([
      { titulo: 'Álbuns em alta', fn: () => deezerAlbuns(0, 20) },
      { titulo: 'Músicas do momento', fn: () => deezerFaixas(20) },
      { titulo: 'Mais baixados na Apple', fn: () => appleAlbuns(20) },
      { titulo: 'MPB', fn: () => deezerAlbuns(78, 20) },
      { titulo: 'Sertanejo', fn: () => deezerAlbuns(80, 20) },
      { titulo: 'Rap e funk brasileiro', fn: () => deezerAlbuns(472, 20) },
    ]),
    juntar([
      { titulo: 'Em alta na semana', fn: () => tmdbLista('trending/all/week') },
      { titulo: 'Filmes populares', fn: () => tmdbLista('movie/popular') },
      { titulo: 'Séries populares', fn: () => tmdbLista('tv/popular') },
      { titulo: 'Melhores de todos os tempos', fn: () => tmdbLista('movie/top_rated') },
    ]),
  ]);

  return { musica, video, tmdbConfigurado: Boolean(env.tmdbKey) };
}

export async function buscarNoCatalogo(termo) {
  const q = String(termo || '').trim();
  if (!q) return { musica: [], video: [] };

  const [musica, video] = await Promise.allSettled([
    (async () => {
      const j = await getJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=20`);
      return (j.data || []).map(albumDeezer);
    })(),
    tmdbLista('search/multi', { query: q }),
  ]);

  return {
    musica: musica.status === 'fulfilled' ? musica.value : [],
    video: video.status === 'fulfilled' ? video.value : [],
    tmdbConfigurado: Boolean(env.tmdbKey),
  };
}
