export type Role = 'admin' | 'viewer';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  accent: string;
  created_at?: string;
  plays?: number;
}

export interface Media {
  id: number;
  kind: 'audio' | 'video';
  title: string;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  genre: string | null;
  year: number | null;
  track_no: number | null;
  disc_no: number | null;
  series: string | null;
  season: number | null;
  episode: number | null;
  duration: number | null;
  cover: string | null;
  color: string | null;
  size: number | null;
  added_at: string;
  favorite?: 0 | 1;
  position?: number;
  completed?: 0 | 1;
  play_count?: number;
  last_played?: string;
}

export interface AlbumSummary {
  album: string;
  artist: string;
  tracks: number;
  cover: string | null;
  color: string | null;
  year?: number | null;
}

export interface ArtistSummary {
  name: string;
  tracks: number;
  albums?: number;
  cover: string | null;
  color: string | null;
}

export interface SeriesSummary {
  name: string;
  episodes: number;
  cover: string | null;
  color: string | null;
}

export interface Playlist {
  id: number;
  user_id: number;
  owner: string;
  name: string;
  description: string | null;
  is_public: 0 | 1;
  items: number;
  cover: string | null;
  color: string | null;
  created_at: string;
}

/** Resultado de busca no iTunes/Deezer/TMDB. */
export interface Candidato {
  fonte: string;
  title: string | null;
  artist?: string | null;
  album?: string | null;
  album_artist?: string | null;
  genre?: string | null;
  year: number | null;
  track_no?: number | null;
  disc_no?: number | null;
  series?: string | null;
  season?: number | null;
  episode?: number | null;
  coverUrl: string | null;
  thumb: string | null;
  subtitulo?: string;
}

export interface HomeData {
  continue: Media[];
  recent: Media[];
  added: Media[];
  top: Media[];
  counts: { tracks: number; videos: number; albums: number };
}

/** Item do catálogo externo (Deezer/Apple/TMDB) — ainda não está na sua biblioteca. */
export interface ItemCatalogo {
  tipo: 'album' | 'faixa' | 'filme' | 'serie';
  id: string;
  titulo: string;
  subtitulo: string;
  capa: string | null;
  backdrop?: string | null;
  ano: number | null;
  nota?: number | null;
  sinopse?: string | null;
  /** Termo pronto pra jogar na busca de torrent. */
  busca: string;
}

export interface SecaoCatalogo {
  titulo: string;
  itens: ItemCatalogo[];
  erro: string | null;
}

/** /catalogo/destaques — já vem agrupado em seções. */
export interface Catalogo {
  musica: SecaoCatalogo[];
  video: SecaoCatalogo[];
  tmdbConfigurado: boolean;
}

/** /catalogo/buscar — lista corrida. */
export interface BuscaCatalogo {
  musica: ItemCatalogo[];
  video: ItemCatalogo[];
  tmdbConfigurado: boolean;
}

export interface PreferenciasBusca {
  termosPreferidos: string[];
  termosBloqueados: string[];
  somentePreferidos: boolean;
  padroes?: {
    termosPreferidos: string[];
    termosBloqueados: string[];
    somentePreferidos: boolean;
  };
}

export interface ResultadoBusca {
  nome: string;
  /** Pontos dos termos preferidos e quais bateram. */
  pontos?: number;
  termos?: string[];
  tamanho: number;
  url: string;
  seeds: number;
  peers: number;
  site: string;
}

export interface ImportacaoTorrent {
  hash: string;
  nome: string | null;
  status: 'pendente' | 'importando' | 'ok' | 'erro';
  arquivos: number;
  erro: string | null;
  importado_em: string | null;
}

export interface Torrent {
  hash: string;
  nome: string;
  estado: string;
  progresso: number;
  tamanho: number;
  baixado: number;
  velocidade: number;
  eta: number;
  seeds: number;
  peers: number;
  concluido: boolean;
  importacao: ImportacaoTorrent | null;
}

export interface TorrentStatus {
  configurado: boolean;
  conectado: boolean;
  versao?: string;
  categoria?: string;
  autoImport?: boolean;
  apagarDepois?: boolean;
  erro?: string;
}

export interface ScanJob {
  running: boolean;
  total: number;
  done: number;
  added: number;
  skipped: number;
  errors: { key: string; error: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}
