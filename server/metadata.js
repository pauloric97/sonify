import { parseBuffer, parseFile } from 'music-metadata';
import { createHash } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { coversDir } from './env.js';
import { getRange } from './storage.js';

const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wav', 'wma']);
const VIDEO_EXT = new Set(['mp4', 'm4v', 'mkv', 'webm', 'mov', 'avi']);

const MIME = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  wma: 'audio/x-ms-wma',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
};

// Quanto do arquivo baixar do bucket pra ler as tags.
const SNIFF = 4 * 1024 * 1024 - 1;

export const extOf = (name) => (name.split('.').pop() || '').toLowerCase();
export const mimeFor = (name) => MIME[extOf(name)] || 'application/octet-stream';

/** audio | video | null (null = arquivo que não é mídia, ignorado no scan) */
export function kindOf(name) {
  const ext = extOf(name);
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (VIDEO_EXT.has(ext)) return 'video';
  return null;
}

/** Cor determinística a partir do texto — usada nos degradês quando não tem capa. */
export function colorFor(text) {
  const h = createHash('md5').update(text || 'sonify').digest();
  const hue = h[0] * 360 / 255;
  const sat = 45 + (h[1] / 255) * 25;
  const light = 28 + (h[2] / 255) * 14;
  return hslToHex(hue, sat, light);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** Grava a capa embutida no arquivo em DATA_DIR/covers e devolve o nome dela. */
function saveCover(picture) {
  if (!picture?.data?.length) return null;
  const buf = Buffer.from(picture.data);
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16);
  const ext = picture.format?.includes('png') ? 'png' : 'jpg';
  const name = `${hash}.${ext}`;
  const dest = path.join(coversDir, name);
  if (!existsSync(dest)) writeFileSync(dest, buf);
  return name;
}

/** Último recurso: adivinha artista/título/temporada pelo nome do arquivo. */
export function guessFromFilename(filename, kind) {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (kind === 'video') {
    const se = base.match(/^(.*?)[\s-]*[Ss](\d{1,2})[\s._-]?[EeXx](\d{1,3})[\s-]*(.*)$/);
    if (se) {
      return {
        series: se[1].trim() || null,
        season: Number(se[2]),
        episode: Number(se[3]),
        title: se[4].trim() || `Episódio ${Number(se[3])}`,
      };
    }
    return { title: base };
  }

  // "01 - Artista - Título" / "Artista - Título" / "01 Título"
  let rest = base;
  let track = null;
  const num = rest.match(/^(\d{1,3})\s*[-–.]?\s+(.*)$/);
  if (num) {
    track = Number(num[1]);
    rest = num[2];
  }
  const parts = rest.split(/\s+[-–]\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), track_no: track };
  }
  return { title: rest, track_no: track };
}

const first = (v) => (Array.isArray(v) ? v[0] : v) || null;

/**
 * Lê as tags baixando só o começo do arquivo do bucket.
 * MP3 (ID3v2) e a maioria dos MP4 gravados por apps modernos têm os metadados no início.
 * Se não der, cai no nome do arquivo — nunca falha o ingest por causa de tag.
 */
export async function extractMetadata({ key, filename, size, kind, durationHint, buffer }) {
  const name = filename || key.split('/').pop();
  const mime = mimeFor(name);
  const fallback = guessFromFilename(name, kind);

  let tags = null;
  try {
    // `buffer` só é usado nos testes; em produção baixa o começo do arquivo do bucket.
    const head = buffer ?? (await getRange(key, 0, Math.min(size ? size - 1 : SNIFF, SNIFF)));
    tags = await parseBuffer(head, { mimeType: mime, size }, { duration: true });
  } catch {
    // tag ilegível/ausente — segue com o fallback
  }

  return montarMeta({ tags, name, mime, size, kind, fallback, durationHint });
}

/**
 * Mesma coisa, mas pra arquivo que já está no disco (import de torrent).
 * Aqui o parser consegue percorrer o arquivo inteiro, então acerta a duração
 * até em mp4 com o índice no fim.
 */
export async function extractMetadataDeArquivo({ caminho, filename, size, kind }) {
  const name = filename || path.basename(caminho);
  const mime = mimeFor(name);
  const fallback = guessFromFilename(name, kind);

  let tags = null;
  try {
    tags = await parseFile(caminho, { duration: true });
  } catch {
    // sem tag: cai no nome do arquivo
  }

  return montarMeta({ tags, name, mime, size, kind, fallback });
}

function montarMeta({ tags, name, mime, size, kind, fallback, durationHint }) {
  const c = tags?.common || {};
  const title = c.title?.trim() || fallback.title || name;
  const artist = c.artist?.trim() || fallback.artist || null;
  const album = c.album?.trim() || null;

  return {
    kind,
    filename: name,
    mime,
    size: size ?? null,
    title,
    artist,
    album,
    album_artist: c.albumartist?.trim() || artist,
    genre: first(c.genre),
    year: c.year || null,
    track_no: c.track?.no ?? fallback.track_no ?? null,
    disc_no: c.disk?.no ?? null,
    series: kind === 'video' ? fallback.series || null : null,
    season: fallback.season ?? null,
    episode: fallback.episode ?? null,
    // `||` de propósito: arquivo sem header decente devolve duração 0, e aí
    // vale mais a medição que o navegador fez antes de subir.
    duration: tags?.format?.duration || durationHint || null,
    cover: saveCover(c.picture?.[0]),
    color: colorFor(album || artist || title),
  };
}
