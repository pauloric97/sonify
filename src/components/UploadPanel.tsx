import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, CloudUpload, Loader2, XCircle } from 'lucide-react';
import { api, getToken } from '../lib/api';
import { formatBytes } from '../lib/format';

type Status = 'aguardando' | 'enviando' | 'pelo-servidor' | 'processando' | 'pronto' | 'erro';

interface Item {
  id: string;
  file: File;
  status: Status;
  progress: number;
  error?: string;
}

/** Lê a duração no próprio navegador — evita depender da tag do arquivo. */
function lerDuracao(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    el.src = url;
    setTimeout(() => done(null), 8000);
  });
}

/** PUT com barra de progresso (fetch não reporta progresso de upload). */
function put(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
  headers: Record<string, string> = {},
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    try {
      xhr.open('PUT', url);
    } catch {
      reject(new Error('URL assinada inválida — confira S3_ENDPOINT e S3_REGION no .env'));
      return;
    }
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detalhe = `HTTP ${xhr.status}`;
      try {
        detalhe = JSON.parse(xhr.responseText).error || detalhe;
      } catch {}
      reject(new Error(detalhe));
    };
    xhr.onerror = () => reject(new Error('rede'));
    xhr.send(file);
  });
}

export function UploadPanel({ onDone }: { onDone?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const processar = useCallback(
    async (item: Item) => {
      try {
        patch(item.id, { status: 'enviando', progress: 0 });
        const duration = await lerDuracao(item.file);

        const { key, url } = await api<{ key: string; url: string }>('/upload/presign', {
          method: 'POST',
          body: { filename: item.file.name, size: item.file.size },
        });

        const progresso = (pct: number) => patch(item.id, { progress: pct });

        try {
          // Caminho rápido: o arquivo vai do navegador direto pro bucket.
          await put(url, item.file, progresso);
        } catch (err) {
          // Bucket sem CORS liberado pro PUT: reenvia passando pelo servidor (mesma origem).
          patch(item.id, { status: 'pelo-servidor', progress: 0 });
          await put(`/api/upload/direct?key=${encodeURIComponent(key)}`, item.file, progresso, {
            Authorization: `Bearer ${getToken() || ''}`,
          });
        }

        patch(item.id, { status: 'processando', progress: 1 });
        await api('/upload/complete', {
          method: 'POST',
          body: { key, filename: item.file.name, size: item.file.size, duration },
        });

        patch(item.id, { status: 'pronto' });
        onDone?.();
      } catch (err) {
        patch(item.id, { status: 'erro', error: (err as Error).message });
      }
    },
    [onDone],
  );

  const adicionar = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const novos: Item[] = Array.from(files).map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        status: 'aguardando',
        progress: 0,
      }));
      setItems((list) => [...list, ...novos]);
      // Dois de cada vez pra não estourar a banda de subida.
      (async () => {
        for (let i = 0; i < novos.length; i += 2) {
          await Promise.all(novos.slice(i, i + 2).map(processar));
        }
      })();
    },
    [processar],
  );

  const enviando = items.some((i) => ['enviando', 'pelo-servidor', 'processando'].includes(i.status));

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          adicionar(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? 'border-brand-500 bg-brand-500/10' : 'border-white/12 hover:border-white/25 hover:bg-white/[0.03]'
        }`}
      >
        <CloudUpload className="h-9 w-9 text-ink-400" />
        <div>
          <p className="font-semibold">Arraste os arquivos aqui</p>
          <p className="mt-1 text-sm text-ink-400">
            mp3, m4a, flac, ogg, wav, mp4, mkv, webm — vão direto pro seu bucket
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="audio/*,video/*,.mp3,.m4a,.flac,.ogg,.opus,.wav,.mp4,.mkv,.webm,.mov"
          className="hidden"
          onChange={(e) => {
            adicionar(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/[0.07] bg-ink-900 p-3">
              <div className="flex items-center gap-3">
                <span className="shrink-0">
                  {item.status === 'pronto' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  {item.status === 'erro' && <XCircle className="h-5 w-5 text-red-400" />}
                  {(item.status === 'enviando' || item.status === 'pelo-servidor' || item.status === 'processando') && (
                    <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
                  )}
                  {item.status === 'aguardando' && <CloudUpload className="h-5 w-5 text-ink-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-ink-400">
                    {formatBytes(item.file.size)}
                    {(item.status === 'enviando' || item.status === 'pelo-servidor') &&
                      ` • ${Math.round(item.progress * 100)}%`}
                    {item.status === 'pelo-servidor' && ' (pelo servidor)'}
                    {item.status === 'processando' && ' • lendo as tags…'}
                    {item.status === 'pronto' && ' • na biblioteca'}
                  </p>
                </div>
              </div>

              {(item.status === 'enviando' || item.status === 'pelo-servidor') && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${item.progress * 100}%`, background: 'var(--accent)' }}
                  />
                </div>
              )}
              {item.error && <p className="mt-2 text-xs text-red-300">{item.error}</p>}
            </div>
          ))}

          {!enviando && (
            <button className="btn-ghost mt-1 self-start" onClick={() => setItems([])}>
              Limpar lista
            </button>
          )}
        </div>
      )}
    </div>
  );
}
