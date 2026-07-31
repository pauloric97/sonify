import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env, storageConfigured } from './env.js';

export const s3 = storageConfigured
  ? new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      forcePathStyle: env.s3.forcePathStyle,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    })
  : null;

const Bucket = env.s3.bucket;

function assertStorage() {
  if (!s3) throw Object.assign(new Error('Storage não configurado'), { status: 503 });
}

/** URL temporária pra tocar o arquivo direto do bucket (o player faz range requests nela). */
export async function presignGet(key, ttl = env.signedUrlTtl) {
  assertStorage();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: ttl });
}

/** URL temporária pro navegador subir o arquivo direto pro bucket, sem passar pelo servidor. */
export async function presignPut(key, contentType, ttl = 3600) {
  assertStorage();
  return getSignedUrl(s3, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), {
    expiresIn: ttl,
  });
}

export async function headObject(key) {
  assertStorage();
  return s3.send(new HeadObjectCommand({ Bucket, Key: key }));
}

export async function deleteObject(key) {
  assertStorage();
  return s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

/** Baixa só um pedaço do arquivo — o suficiente pra ler as tags sem puxar 80MB. */
export async function getRange(key, start, end) {
  assertStorage();
  const out = await s3.send(
    new GetObjectCommand({ Bucket, Key: key, Range: `bytes=${start}-${end}` }),
  );
  const chunks = [];
  for await (const chunk of out.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function putBuffer(key, body, contentType) {
  assertStorage();
  return s3.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
}

/**
 * Sobe um stream (o corpo da request) direto pro bucket, sem juntar tudo na memória.
 * É o plano B de quando o bucket não tem CORS liberado pro PUT do navegador.
 */
export async function putStream(key, stream, contentType, contentLength) {
  assertStorage();
  return s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
  );
}

/** Lista tudo do bucket (paginado), opcionalmente sob um prefixo. */
export async function listAll(prefix = env.s3.prefix) {
  assertStorage();
  const items = [];
  let token;
  do {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix: prefix || undefined,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const o of out.Contents || []) {
      if (o.Key.endsWith('/')) continue;
      items.push({ key: o.Key, size: o.Size, modified: o.LastModified });
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return items;
}

/** Monta a chave final do objeto respeitando o S3_PREFIX. */
export function buildKey(kind, filename) {
  const safe = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .trim();
  const stamp = Date.now().toString(36);
  const folder = kind === 'video' ? 'video' : 'audio';
  return `${env.s3.prefix}${folder}/${stamp}-${safe}`;
}

export { storageConfigured };
