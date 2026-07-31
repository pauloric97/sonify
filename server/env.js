import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Carrega .env sem dependência externa (Node 20.12+).
const envFile = path.resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('[env] não consegui ler o .env:', err.message);
  }
}

const bool = (v, fallback = false) =>
  v === undefined || v === '' ? fallback : /^(1|true|yes|on)$/i.test(String(v));

/** Aceita endpoint com ou sem esquema e com barra no fim — erra fácil no .env. */
function normalizeEndpoint(raw) {
  let ep = String(raw || '').trim().replace(/\/+$/, '');
  if (!ep) return '';
  if (!/^https?:\/\//i.test(ep)) ep = `https://${ep}`;
  try {
    new URL(ep);
  } catch {
    console.error(`[env] S3_ENDPOINT inválido: "${raw}"`);
    return '';
  }
  return ep;
}

/** B2 assina com a região do endpoint; "auto" só vale pro R2. */
function resolveRegion(region, endpoint) {
  const r = String(region || '').trim();
  const b2 = endpoint.match(/^https?:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  if (b2 && (!r || r.toLowerCase() === 'auto')) {
    console.warn(`[env] S3_REGION ajustado para "${b2[1]}" (Backblaze não aceita "auto").`);
    return b2[1];
  }
  return r || 'auto';
}

const endpoint = normalizeEndpoint(process.env.S3_ENDPOINT);

export const env = {
  port: Number(process.env.PORT || 3000),
  isProd: process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET || '',
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || './data'),
  signedUrlTtl: Number(process.env.SIGNED_URL_TTL || 21600),
  // Busca de capa/metadados em APIs externas.
  tmdbKey: (process.env.TMDB_API_KEY || '').trim(),
  enrichOnIngest: bool(process.env.ENRICH_ON_INGEST, true),
  qbit: {
    url: normalizeEndpoint(process.env.QBIT_URL),
    user: process.env.QBIT_USER || '',
    pass: process.env.QBIT_PASS || '',
    // Só mexemos em torrent dessa categoria — o resto do qBittorrent fica intocado.
    category: process.env.QBIT_CATEGORY || 'sonify',
    savePath: process.env.QBIT_SAVE_PATH || '',
    autoImport: bool(process.env.QBIT_AUTO_IMPORT, true),
    deleteAfter: bool(process.env.QBIT_DELETE_AFTER, true),
    pollSeconds: Math.max(10, Number(process.env.QBIT_POLL_SECONDS || 30)),
    minFileBytes: Number(process.env.QBIT_MIN_FILE_BYTES || 300_000),
  },
  s3: {
    endpoint,
    region: resolveRegion(process.env.S3_REGION, endpoint),
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, false),
    prefix: (process.env.S3_PREFIX || '').replace(/^\/+/, ''),
  },
};

export const coversDir = path.join(env.dataDir, 'covers');

if (!existsSync(env.dataDir)) mkdirSync(env.dataDir, { recursive: true });
if (!existsSync(coversDir)) mkdirSync(coversDir, { recursive: true });

if (!env.jwtSecret) {
  console.error('\n[env] JWT_SECRET não definido. Crie um .env (veja .env.example):');
  console.error('      openssl rand -hex 32\n');
  process.exit(1);
}

export const storageConfigured = Boolean(
  env.s3.endpoint && env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey,
);

if (!storageConfigured) {
  console.warn('[env] storage S3 não configurado — upload, scan e streaming ficam indisponíveis.');
}
