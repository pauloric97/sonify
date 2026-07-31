import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';
import { one, run } from './db.js';
import { buildKey, putStream } from './storage.js';
import { extractMetadataDeArquivo, kindOf, mimeFor } from './metadata.js';
import { buscarCandidatos, montarPatch } from './enrich.js';

/** Grava a linha na biblioteca. Usado pelo upload, pelo scan e pelo import de torrent. */
export function insertMedia(meta, key, userId) {
  const info = run(
    `INSERT INTO media (kind, storage_key, filename, size, mime, duration, title, artist, album,
                        album_artist, genre, year, track_no, disc_no, series, season, episode,
                        cover, color, added_by)
     VALUES (:kind, :key, :filename, :size, :mime, :duration, :title, :artist, :album,
             :album_artist, :genre, :year, :track_no, :disc_no, :series, :season, :episode,
             :cover, :color, :added_by)`,
    { ...meta, key, added_by: userId },
  );
  return one('SELECT * FROM media WHERE id = :id', { id: info.lastInsertRowid });
}

/**
 * Completa o que a tag do arquivo não trouxe usando iTunes/Deezer/TMDB.
 * Só preenche campo vazio — tag do arquivo sempre ganha. Falha aqui nunca derruba o ingest.
 */
export async function completarComApi(meta) {
  if (!env.enrichOnIngest) return meta;

  const faltaCapa = !meta.cover;
  const faltaDado =
    meta.kind === 'video' ? !meta.series && !meta.year : !meta.artist || !meta.album;
  if (!faltaCapa && !faltaDado) return meta;

  try {
    const [melhor] = await buscarCandidatos(meta);
    if (!melhor) return meta;
    const patch = await montarPatch(meta, melhor, { somenteVazios: true });
    return { ...meta, ...patch };
  } catch {
    return meta;
  }
}

/**
 * Sobe um arquivo que já está no disco do servidor pro bucket e cadastra na biblioteca.
 * É o caminho usado pelo import de torrent — o arquivo vai em stream, sem carregar na memória.
 */
export async function importarArquivoLocal({ caminho, userId }) {
  const nome = path.basename(caminho);
  const kind = kindOf(nome);
  if (!kind) return null;

  const { size } = statSync(caminho);
  if (size < env.qbit.minFileBytes) return null; // sample, thumbnail, sobra

  if (one('SELECT id FROM media WHERE filename = :nome AND size = :size', { nome, size }))
    return null; // já importado antes

  const key = buildKey(kind, nome);
  await putStream(key, createReadStream(caminho), mimeFor(nome), size);

  const meta = await extractMetadataDeArquivo({ caminho, filename: nome, size, kind });
  return insertMedia(await completarComApi(meta), key, userId);
}
