import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Compass, Disc3, Download, Film, Loader2, Search, Star, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApi, useDebounced } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { formatBytes } from '../lib/format';
import { Empty, ErrorBox, Loading, Row, Sheet, SectionTitle } from '../components/ui';
import type { BuscaCatalogo, Catalogo, ItemCatalogo, ResultadoBusca, SecaoCatalogo } from '../types';

export function ExplorarPage() {
  const [aba, setAba] = useState<'musica' | 'video'>('musica');
  const [q, setQ] = useState('');
  const termo = useDebounced(q.trim(), 350);
  const [item, setItem] = useState<ItemCatalogo | null>(null);

  const destaques = useApi<Catalogo>('/catalogo/destaques');
  const busca = useApi<BuscaCatalogo>(termo ? `/catalogo/buscar?q=${encodeURIComponent(termo)}` : null);

  const carregando = termo ? busca.loading : destaques.loading;
  const erro = termo ? busca.error : destaques.error;
  const tmdbConfigurado = (termo ? busca.data : destaques.data)?.tmdbConfigurado ?? true;

  // Busca vem como lista corrida; destaques já vêm em seções.
  const secoes: SecaoCatalogo[] = termo
    ? busca.data
      ? [{ titulo: 'Resultados', itens: aba === 'musica' ? busca.data.musica : busca.data.video, erro: null }]
      : []
    : destaques.data
      ? aba === 'musica'
        ? destaques.data.musica
        : destaques.data.video
      : [];

  return (
    <div className="mx-auto max-w-[1400px] py-6">
      <div className="mb-5 flex items-center gap-3">
        <Compass className="h-7 w-7" style={{ color: 'var(--accent)' }} />
        <h1 className="text-3xl font-bold tracking-tight">Explorar</h1>
      </div>
      <p className="mb-5 max-w-2xl text-sm text-ink-400">
        O que está bombando lá fora. Achou algo que quer ter na sua biblioteca? Abre e manda procurar.
      </p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-500" />
        <input
          className="field pl-11 pr-11"
          placeholder="Procurar álbum, filme, série…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="icon-btn absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label="Limpar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-6 flex gap-2">
        {(
          [
            ['musica', 'Música', Disc3],
            ['video', 'Filmes e séries', Film],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`chip flex items-center gap-2 ${
              aba === id ? 'text-white' : 'bg-white/[0.07] text-ink-300 hover:bg-white/[0.12]'
            }`}
            style={aba === id ? { background: 'var(--accent)' } : undefined}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {erro && <ErrorBox message={erro} />}
      {carregando && <Loading label="Buscando novidades…" />}

      {!carregando && aba === 'video' && !tmdbConfigurado && (
        <Empty
          icon={<Film className="h-9 w-9" />}
          title="Filmes e séries precisam da chave do TMDB"
          hint="Crie uma chave grátis em themoviedb.org (API Key v3), coloque em TMDB_API_KEY no .env e reinicie o servidor. Música funciona sem chave nenhuma."
        />
      )}

      {!carregando &&
        secoes.map((secao) =>
          secao.itens.length ? (
            <section key={secao.titulo} className="mb-8">
              <SectionTitle>{secao.titulo}</SectionTitle>
              <Row>
                {secao.itens.map((it) => (
                  <CardExterno key={it.id} item={it} onAbrir={() => setItem(it)} />
                ))}
              </Row>
            </section>
          ) : null,
        )}

      {!carregando && termo && !secoes[0]?.itens.length && aba === 'musica' && (
        <Empty title="Nada encontrado" hint={`Nenhum resultado para "${termo}".`} />
      )}

      <DetalheItem item={item} onFechar={() => setItem(null)} />
    </div>
  );
}

function CardExterno({ item, onAbrir }: { item: ItemCatalogo; onAbrir: () => void }) {
  const retrato = item.tipo === 'filme' || item.tipo === 'serie';
  return (
    <button
      onClick={onAbrir}
      className="group w-[150px] shrink-0 snap-start rounded-2xl p-2.5 text-left transition hover:bg-white/[0.06] sm:w-[172px]"
    >
      <div
        className={`relative mb-3 overflow-hidden rounded-xl bg-ink-800 shadow-lg shadow-black/40 ${
          retrato ? 'aspect-[2/3]' : 'aspect-square'
        }`}
      >
        {item.capa ? (
          <img src={item.capa} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-ink-600">
            {retrato ? <Film className="h-8 w-8" /> : <Disc3 className="h-8 w-8" />}
          </div>
        )}
        {item.nota ? (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.nota}
          </span>
        ) : null}
      </div>
      <p className="truncate text-sm font-semibold">{item.titulo}</p>
      <p className="truncate text-[13px] text-ink-400">{item.subtitulo || item.ano || ''}</p>
    </button>
  );
}

/** Detalhe do item + busca de torrent. */
function DetalheItem({ item, onFechar }: { item: ItemCatalogo | null; onFechar: () => void }) {
  const { user } = useAuth();
  const [buscaId, setBuscaId] = useState<number | null>(null);
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [procurando, setProcurando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionado, setAdicionado] = useState<string | null>(null);
  const [ocultos, setOcultos] = useState(0);
  // Em ref também: o intervalo de polling é criado uma vez e precisa ler o valor atual.
  const todosRef = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // O id fica em ref: se dependesse do estado, o efeito de limpeza rodaria ao
  // gravar o id e mataria o intervalo que acabou de ser criado.
  const idRef = useRef<number | null>(null);

  const pararTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  /** Para de puxar resultados e avisa o qBittorrent que pode descartar a busca. */
  const encerrar = useCallback(() => {
    pararTimer();
    if (idRef.current) {
      api(`/torrents/buscar/${idRef.current}`, { method: 'DELETE' }).catch(() => {});
      idRef.current = null;
    }
  }, [pararTimer]);

  // Fechou o sheet? Encerra a busca lá no qBittorrent.
  useEffect(() => {
    if (!item) {
      encerrar();
      setBuscaId(null);
      setResultados([]);
      setErro(null);
      setAdicionado(null);
      setProcurando(false);
      setOcultos(0);
      todosRef.current = false;
    }
  }, [item, encerrar]);

  useEffect(() => encerrar, [encerrar]);

  if (!item) return null;

  const procurar = async () => {
    setProcurando(true);
    setErro(null);
    setResultados([]);
    setOcultos(0);
    try {
      const { id } = await api<{ id: number }>('/torrents/buscar', {
        method: 'POST',
        body: { termo: item.busca },
      });
      idRef.current = id;
      setBuscaId(id);

      let voltas = 0;
      timer.current = setInterval(async () => {
        voltas++;
        try {
          const r = await api<{ status: string; itens: ResultadoBusca[]; ocultos: number }>(
            `/torrents/buscar/${id}${todosRef.current ? '?todos=1' : ''}`,
          );
          setResultados(r.itens);
          setOcultos(r.ocultos || 0);
          // Os plugins respondem em tempos diferentes; 30s é bastante.
          if (r.status !== 'Running' || voltas > 20) {
            pararTimer();
            setProcurando(false);
          }
        } catch (e) {
          pararTimer();
          setProcurando(false);
          setErro((e as Error).message);
        }
      }, 1500);
    } catch (e) {
      setProcurando(false);
      setErro((e as Error).message);
    }
  };

  /** Refaz a consulta ignorando o filtro de "só preferidos". */
  const mostrarEscondidos = async () => {
    todosRef.current = true;
    if (!idRef.current) return;
    try {
      const r = await api<{ itens: ResultadoBusca[] }>(`/torrents/buscar/${idRef.current}?todos=1`);
      setResultados(r.itens);
      setOcultos(0);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const baixar = async (r: ResultadoBusca) => {
    try {
      await api('/torrents/da-busca', { method: 'POST', body: { url: r.url } });
      setAdicionado(r.nome);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <Sheet open onClose={onFechar} title={item.titulo}>
      <div className="mb-4 flex gap-4">
        <div
          className={`shrink-0 overflow-hidden rounded-xl bg-ink-800 ${
            item.tipo === 'filme' || item.tipo === 'serie' ? 'h-[132px] w-[88px]' : 'h-[88px] w-[88px]'
          }`}
        >
          {item.capa && <img src={item.capa} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{item.titulo}</p>
          <p className="text-sm text-ink-400">{item.subtitulo}</p>
          {item.nota ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-amber-300">
              <Star className="h-3.5 w-3.5 fill-current" />
              {item.nota}
            </p>
          ) : null}
          {item.sinopse && <p className="mt-2 line-2 text-[13px] text-ink-400">{item.sinopse}</p>}
        </div>
      </div>

      {adicionado ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Mandei baixar
          </p>
          <p className="mt-1 truncate text-xs text-emerald-200/70">{adicionado}</p>
          <Link to="/downloads" className="btn-ghost mt-3 w-full" onClick={onFechar}>
            Acompanhar em Downloads
          </Link>
        </div>
      ) : user?.role !== 'admin' ? (
        <p className="rounded-xl bg-white/[0.05] p-4 text-sm text-ink-400">
          Só o administrador pode baixar conteúdo novo.
        </p>
      ) : (
        <>
          {!buscaId && (
            <button className="btn-primary w-full" onClick={procurar} disabled={procurando}>
              {procurando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Procurar no qBittorrent
            </button>
          )}

          {erro && (
            <div className="mt-3">
              <ErrorBox message={erro} />
            </div>
          )}

          {buscaId && (
            <div className="mt-3">
              <p className="mb-2 flex items-center gap-2 text-xs text-ink-400">
                {procurando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {procurando
                  ? `procurando por “${item.busca}”…`
                  : `${resultados.length} resultado(s) para “${item.busca}”`}
              </p>

              <div className="flex flex-col gap-1">
                {resultados.map((r, i) => (
                  <button
                    key={`${r.url}-${i}`}
                    onClick={() => baixar(r)}
                    className="flex items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/[0.07]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{r.nome}</p>
                      <p className="text-[11px] text-ink-400">
                        {formatBytes(r.tamanho)} • {r.seeds} seeds • {r.peers} peers
                      </p>
                      {r.termos?.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {r.termos.map((t) => (
                            <span
                              key={t}
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }}
                            >
                              {t}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                    <Download className="h-4 w-4 shrink-0 text-ink-400" />
                  </button>
                ))}
              </div>

              {ocultos > 0 && (
                <button
                  onClick={mostrarEscondidos}
                  className="mt-2 w-full rounded-xl bg-white/[0.04] py-2 text-xs text-ink-400 hover:text-white"
                >
                  {ocultos} resultado(s) escondido(s) pelos seus filtros — mostrar mesmo assim
                </button>
              )}

              {!procurando && !resultados.length && (
                <p className="py-4 text-center text-sm text-ink-400">
                  {ocultos > 0
                    ? 'Tudo que veio foi filtrado pelos seus termos.'
                    : 'Nenhum resultado. Tente outro termo na busca do topo.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
