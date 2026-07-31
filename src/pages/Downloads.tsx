import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, Loader2, Magnet, Pause, Play, Stethoscope, Trash2,
  Upload, XCircle,
} from 'lucide-react';
import { api, getToken } from '../lib/api';
import { formatBytes } from '../lib/format';
import { Empty, ErrorBox, Loading } from '../components/ui';
import type { EtapaDiagnostico, Torrent, TorrentStatus } from '../types';

const ESTADOS: Record<string, string> = {
  downloading: 'baixando',
  metaDL: 'buscando metadados',
  stalledDL: 'parado (sem seeds)',
  pausedDL: 'pausado',
  stoppedDL: 'pausado',
  queuedDL: 'na fila',
  uploading: 'semeando',
  stalledUP: 'semeando',
  pausedUP: 'concluído',
  stoppedUP: 'concluído',
  checkingDL: 'verificando',
  checkingUP: 'verificando',
  error: 'erro',
  missingFiles: 'arquivos sumiram',
};

function tempo(segundos: number) {
  if (!segundos || segundos >= 8640000) return '—';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h) return `${h}h ${m}min`;
  if (m) return `${m}min`;
  return `${segundos}s`;
}

/** Testa a integração etapa por etapa — login, plugins e uma busca de verdade. */
function Diagnostico() {
  const [etapas, setEtapas] = useState<EtapaDiagnostico[] | null>(null);
  const [rodando, setRodando] = useState(false);

  const testar = async () => {
    setRodando(true);
    setEtapas(null);
    try {
      const r = await api<{ etapas: EtapaDiagnostico[] }>('/torrents/diagnostico');
      setEtapas(r.etapas);
    } catch (e) {
      setEtapas([{ nome: 'Diagnóstico', ok: false, detalhe: (e as Error).message }]);
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="mb-6">
      <button className="btn-ghost text-[13px]" onClick={testar} disabled={rodando}>
        {rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
        {rodando ? 'Testando…' : 'Testar conexão com o qBittorrent'}
      </button>

      {etapas && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-2xl border border-white/[0.07] p-4">
          {etapas.map((e) => (
            <div key={e.nome} className="flex items-start gap-2.5 text-[13px]">
              {e.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              )}
              <div className="min-w-0">
                <span className="font-medium">{e.nome}</span>
                <span className="text-ink-400"> — {e.detalhe}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DownloadsPage() {
  const [status, setStatus] = useState<TorrentStatus | null>(null);
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [magnet, setMagnet] = useState('');
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api<{ torrents: Torrent[] }>('/torrents');
      setTorrents(r.torrents);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    api<TorrentStatus>('/torrents/status').then(setStatus).catch(() => {});
    carregar();
    // Enquanto a tela está aberta, atualiza o progresso.
    const timer = setInterval(carregar, 3000);
    return () => clearInterval(timer);
  }, [carregar]);

  const adicionar = async () => {
    if (!magnet.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      await api('/torrents', { method: 'POST', body: { magnet: magnet.trim() } });
      setMagnet('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const enviarArquivo = async (file: File) => {
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/torrents/arquivo?nome=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-bittorrent',
          Authorization: `Bearer ${getToken() || ''}`,
        },
        body: file,
      });
      if (!res.ok) throw new Error((await res.json()).error || `Erro ${res.status}`);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const acao = async (hash: string, caminho: string) => {
    try {
      await api(`/torrents/${hash}/${caminho}`, { method: 'POST' });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const remover = async (t: Torrent) => {
    if (!confirm(`Remover "${t.nome}" e apagar os arquivos baixados?`)) return;
    try {
      await api(`/torrents/${t.hash}`, { method: 'DELETE' });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  if (carregando) return <Loading />;

  if (status && !status.configurado)
    return (
      <div className="mx-auto max-w-3xl py-6">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Downloads</h1>
        <Empty
          icon={<Download className="h-10 w-10" />}
          title="qBittorrent não configurado"
          hint="Ligue a Web UI no qBittorrent (Ferramentas → Opções → Web UI) e preencha QBIT_URL, QBIT_USER e QBIT_PASS no .env."
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
        {status?.conectado && (
          <span className="text-xs text-ink-500">
            qBittorrent {status.versao} • categoria “{status.categoria}”
            {status.apagarDepois ? ' • apaga o local ao importar' : ''}
          </span>
        )}
      </div>

      {status && status.configurado && !status.conectado && (
        <div className="mb-4">
          <ErrorBox message={status.erro || 'Não consegui conectar no qBittorrent'} />
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Magnet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            className="field pl-10"
            placeholder="Cole o magnet link aqui"
            value={magnet}
            onChange={(e) => setMagnet(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          />
        </div>
        <button className="btn-primary shrink-0" onClick={adicionar} disabled={enviando || !magnet.trim()}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar
        </button>
      </div>

      <button
        className="btn-ghost mb-6 text-[13px]"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
      >
        <Upload className="h-4 w-4" />
        ou envie um arquivo .torrent
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".torrent,application/x-bittorrent"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) enviarArquivo(f);
          e.target.value = '';
        }}
      />

      {erro && (
        <div className="mb-4">
          <ErrorBox message={erro} />
        </div>
      )}

      <Diagnostico />


      {!torrents.length ? (
        <Empty
          icon={<Download className="h-9 w-9" />}
          title="Nenhum download em andamento"
          hint="Quando terminar, o arquivo vai pro seu bucket e entra na biblioteca sozinho."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {torrents.map((t) => {
            const imp = t.importacao;
            const pct = Math.round(t.progresso * 100);
            return (
              <div key={t.hash} className="rounded-2xl border border-white/[0.07] bg-ink-900 p-4">
                <div className="mb-2 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.nome}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {formatBytes(t.baixado)} de {formatBytes(t.tamanho)} •{' '}
                      {ESTADOS[t.estado] || t.estado}
                      {t.velocidade > 0 && ` • ${formatBytes(t.velocidade)}/s`}
                      {!t.concluido && t.eta > 0 && ` • faltam ${tempo(t.eta)}`}
                      {t.seeds > 0 && ` • ${t.seeds} seeds`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {!t.concluido && (
                      <button
                        onClick={() => acao(t.hash, t.estado.includes('paused') || t.estado.includes('stopped') ? 'retomar' : 'pausar')}
                        className="icon-btn h-9 w-9"
                        aria-label="Pausar ou retomar"
                      >
                        {t.estado.includes('paused') || t.estado.includes('stopped') ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button onClick={() => remover(t)} className="icon-btn h-9 w-9 text-red-400" aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: imp?.status === 'ok' ? '#34d399' : 'var(--accent)',
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs tabular-nums text-ink-500">{pct}%</span>

                  {imp?.status === 'ok' && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {imp.arquivos} {imp.arquivos === 1 ? 'arquivo' : 'arquivos'} na biblioteca
                    </span>
                  )}
                  {imp?.status === 'importando' && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      subindo pro bucket…
                    </span>
                  )}
                  {imp?.status === 'erro' && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {imp.erro}
                      <button
                        onClick={() => acao(t.hash, 'importar')}
                        className="ml-1 underline hover:text-white"
                      >
                        tentar de novo
                      </button>
                    </span>
                  )}
                  {t.concluido && !imp && (
                    <button
                      onClick={() => acao(t.hash, 'importar')}
                      className="text-xs text-ink-400 underline hover:text-white"
                    >
                      importar agora
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
