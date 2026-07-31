-- Sonify — esquema SQLite. Idempotente: roda sempre no boot.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer',   -- admin | viewer
  accent        TEXT NOT NULL DEFAULT '#7c5cff',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL,                     -- audio | video
  storage_key  TEXT NOT NULL UNIQUE,
  filename     TEXT,
  size         INTEGER,
  mime         TEXT,
  duration     REAL,                              -- segundos
  title        TEXT NOT NULL,
  artist       TEXT,
  album        TEXT,
  album_artist TEXT,
  genre        TEXT,
  year         INTEGER,
  track_no     INTEGER,
  disc_no      INTEGER,
  series       TEXT,                              -- vídeo: nome da série/coleção
  season       INTEGER,
  episode      INTEGER,
  cover        TEXT,                              -- arquivo em DATA_DIR/covers
  color        TEXT,                              -- cor média da capa (#rrggbb)
  added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  added_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_kind      ON media(kind);
CREATE INDEX IF NOT EXISTS idx_media_album     ON media(album_artist, album);
CREATE INDEX IF NOT EXISTS idx_media_artist    ON media(artist);
CREATE INDEX IF NOT EXISTS idx_media_series    ON media(series, season, episode);
CREATE INDEX IF NOT EXISTS idx_media_added     ON media(added_at DESC);

CREATE TABLE IF NOT EXISTS playlists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_public   INTEGER NOT NULL DEFAULT 1,         -- visível pros outros perfis
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_items (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, media_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, media_id)
);

-- "Continuar de onde parou" (principalmente vídeo).
CREATE TABLE IF NOT EXISTS progress (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position   REAL NOT NULL DEFAULT 0,
  duration   REAL,
  completed  INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, media_id)
);

-- Histórico de reproduções (alimenta "tocadas recentemente" e "mais tocadas").
CREATE TABLE IF NOT EXISTS plays (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id  INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  ms_played INTEGER NOT NULL DEFAULT 0,
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plays_user ON plays(user_id, played_at DESC);

-- Configurações editáveis pela interface (valor em JSON).
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Torrents que o Sonify já importou, pra não importar duas vezes.
CREATE TABLE IF NOT EXISTS torrents (
  hash        TEXT PRIMARY KEY,
  nome        TEXT,
  status      TEXT NOT NULL DEFAULT 'pendente',  -- pendente | importando | ok | erro
  arquivos    INTEGER NOT NULL DEFAULT 0,
  erro        TEXT,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  importado_em TEXT
);
