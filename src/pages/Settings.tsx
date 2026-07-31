import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, LogOut, Plus, RefreshCw, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { UploadPanel } from '../components/UploadPanel';
import { ErrorBox, Loading, Sheet } from '../components/ui';
import type { PreferenciasBusca, ScanJob, User } from '../types';

const ACCENTS = ['#7c5cff', '#e84ab2', '#22c55e', '#f59e0b', '#38bdf8', '#ef4444'];

export function SettingsPage() {
  const { user, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'perfil';
  const admin = user?.role === 'admin';

  const tabs = [
    { id: 'perfil', label: 'Perfil' },
    ...(admin
      ? [
          { id: 'upload', label: 'Enviar' },
          { id: 'biblioteca', label: 'Biblioteca' },
          { id: 'busca', label: 'Busca' },
          { id: 'usuarios', label: 'Perfis' },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="mb-5 text-3xl font-bold tracking-tight">Ajustes</h1>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams(t.id === 'perfil' ? {} : { tab: t.id })}
            className={`chip shrink-0 ${
              tab === t.id ? 'text-white' : 'bg-white/[0.07] text-ink-300 hover:bg-white/[0.12]'
            }`}
            style={tab === t.id ? { background: 'var(--accent)' } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'busca' && admin && <BuscaTab />}
      {tab === 'perfil' && <PerfilTab />}
      {tab === 'upload' && admin && <UploadTab />}
      {tab === 'biblioteca' && admin && <BibliotecaTab />}
      {tab === 'usuarios' && admin && <UsuariosTab />}

      <button onClick={logout} className="btn-outline mt-10 text-red-300">
        <LogOut className="h-4 w-4" />
        Sair da conta
      </button>
    </div>
  );
}

function PerfilTab() {
  const { user, updateMe } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [accent, setAccent] = useState(user?.accent || ACCENTS[0]);
  const [currentPassword, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const salvar = async () => {
    setError(null);
    setMsg(null);
    try {
      await updateMe({
        name,
        accent,
        ...(password ? { password, currentPassword } : {}),
      });
      setPassword('');
      setCurrent('');
      setMsg('Salvo.');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">Nome</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div>
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-ink-400">
          Cor de destaque
        </span>
        <div className="flex gap-2.5">
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setAccent(c);
                document.documentElement.style.setProperty('--accent', c);
              }}
              className={`h-9 w-9 rounded-full transition ${
                accent === c ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-950' : ''
              }`}
              style={{ background: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] p-4">
        <p className="mb-3 text-sm font-semibold">Trocar senha</p>
        <div className="flex flex-col gap-3">
          <input
            className="field"
            type="password"
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className="field"
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      <button className="btn-primary self-start" onClick={salvar}>
        Salvar alterações
      </button>

      <p className="text-xs text-ink-500">
        Conta: {user?.email} • {user?.role === 'admin' ? 'administrador' : 'perfil de visualização'}
      </p>
    </div>
  );
}

function UploadTab() {
  return (
    <div>
      <p className="mb-4 text-sm text-ink-400">
        Os arquivos vão do navegador direto pro bucket, sem passar pelo servidor. Depois o servidor lê
        as tags (título, artista, capa) sozinho.
      </p>
      <UploadPanel />
    </div>
  );
}

function BibliotecaTab() {
  const [job, setJob] = useState<ScanJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);

  // Enquanto o scan roda, fica olhando o progresso.
  useEffect(() => {
    if (!job?.running) return;
    const timer = setInterval(() => {
      api<{ job: ScanJob }>('/scan/status')
        .then((r) => setJob(r.job))
        .catch(() => {});
    }, 1200);
    return () => clearInterval(timer);
  }, [job?.running]);

  useEffect(() => {
    api<{ job: ScanJob }>('/scan/status')
      .then((r) => setJob(r.job))
      .catch(() => {});
  }, []);

  const escanear = async () => {
    setError(null);
    try {
      const r = await api<{ job: ScanJob }>('/scan', { method: 'POST' });
      setJob({ ...r.job, running: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const limpar = async () => {
    if (!confirm('Remover da biblioteca os itens cujo arquivo não existe mais no bucket?')) return;
    setPruning(true);
    setError(null);
    try {
      const r = await api<{ removed: number }>('/scan/prune', { method: 'POST' });
      alert(`${r.removed} item(ns) removido(s).`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPruning(false);
    }
  };

  const pct = job?.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-white/[0.07] p-5">
        <p className="font-semibold">Importar do bucket</p>
        <p className="mt-1 text-sm text-ink-400">
          Varre o bucket inteiro e cadastra tudo que ainda não está na biblioteca. Serve pra quando você
          joga os arquivos por fora (rclone, painel do R2/B2).
        </p>

        <button className="btn-primary mt-4" onClick={escanear} disabled={job?.running}>
          <RefreshCw className={`h-4 w-4 ${job?.running ? 'animate-spin' : ''}`} />
          {job?.running ? 'Escaneando…' : 'Escanear bucket'}
        </button>

        {job && (job.running || job.finishedAt) && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full transition-all"
                style={{ width: `${job.running ? pct : 100}%`, background: 'var(--accent)' }}
              />
            </div>
            <p className="mt-2 text-sm text-ink-400">
              {job.running
                ? `${job.done} de ${job.total} arquivos…`
                : `${job.added} adicionados • ${job.skipped} já existiam${
                    job.errors.length ? ` • ${job.errors.length} com erro` : ''
                  }`}
            </p>
            {job.errors.slice(0, 5).map((e) => (
              <p key={e.key} className="mt-1 truncate text-xs text-red-300">
                {e.key}: {e.error}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.07] p-5">
        <p className="font-semibold">Limpar órfãos</p>
        <p className="mt-1 text-sm text-ink-400">
          Tira da biblioteca o que você apagou do bucket por fora.
        </p>
        <button className="btn-outline mt-4" onClick={limpar} disabled={pruning}>
          <Trash2 className="h-4 w-4" />
          {pruning ? 'Limpando…' : 'Limpar órfãos'}
        </button>
      </div>

      {error && <ErrorBox message={error} />}
    </div>
  );
}

/** Lista com ordem editável — a posição é a prioridade. */
function ListaTermos({
  termos,
  onChange,
  numerada,
  placeholder,
}: {
  termos: string[];
  onChange: (t: string[]) => void;
  numerada?: boolean;
  placeholder: string;
}) {
  const [novo, setNovo] = useState('');

  const mover = (i: number, delta: number) => {
    const destino = i + delta;
    if (destino < 0 || destino >= termos.length) return;
    const copia = [...termos];
    [copia[i], copia[destino]] = [copia[destino], copia[i]];
    onChange(copia);
  };

  const adicionar = () => {
    const t = novo.trim().toLowerCase();
    if (!t || termos.includes(t)) return setNovo('');
    onChange([...termos, t]);
    setNovo('');
  };

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <input
          className="field"
          placeholder={placeholder}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionar())}
        />
        <button className="btn-ghost shrink-0" onClick={adicionar} disabled={!novo.trim()}>
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {termos.map((t, i) => (
          <div key={t} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
            {numerada && (
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-ink-500">{i + 1}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm">{t}</span>
            {numerada && (
              <>
                <button
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="icon-btn h-7 w-7 disabled:opacity-25"
                  aria-label="Subir"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={i === termos.length - 1}
                  className="icon-btn h-7 w-7 disabled:opacity-25"
                  aria-label="Descer"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => onChange(termos.filter((x) => x !== t))}
              className="icon-btn h-7 w-7 text-red-400"
              aria-label="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!termos.length && <p className="px-1 py-2 text-sm text-ink-500">Nenhum termo.</p>}
      </div>
    </div>
  );
}

function BuscaTab() {
  const { data, loading, error, reload } = useApi<PreferenciasBusca>('/config/busca');
  const [prefs, setPrefs] = useState<PreferenciasBusca | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  if (loading || !prefs) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const alterar = (patch: Partial<PreferenciasBusca>) => {
    setPrefs({ ...prefs, ...patch });
    setMsg(null);
  };

  const salvar = async () => {
    setSalvando(true);
    setErr(null);
    try {
      await api('/config/busca', {
        method: 'PUT',
        body: {
          termosPreferidos: prefs.termosPreferidos,
          termosBloqueados: prefs.termosBloqueados,
          somentePreferidos: prefs.somentePreferidos,
        },
      });
      setMsg('Salvo.');
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-400">
        Quando você manda procurar um filme ou série no qBittorrent, os resultados são ordenados por
        esses termos. Quem está mais em cima vale mais ponto — se um release tem “dual audio” e outro
        só “legendado”, o primeiro sobe. Empate desempata por seeds.
      </p>

      <div>
        <p className="mb-1 text-sm font-semibold">Termos preferidos, em ordem de prioridade</p>
        <p className="mb-3 text-xs text-ink-500">
          Combina por palavra inteira, então “pt-br”, “PT_BR” e “PT.BR” dão no mesmo. Serve pra
          idioma e também pra qualidade (1080p, remux…).
        </p>
        <ListaTermos
          termos={prefs.termosPreferidos}
          onChange={(termosPreferidos) => alterar({ termosPreferidos })}
          numerada
          placeholder="ex: dual audio"
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold">Termos bloqueados</p>
        <p className="mb-3 text-xs text-ink-500">
          Some da lista de resultados. Como a comparação é por palavra inteira, bloquear “cam” não
          derruba “Camila Cabello”.
        </p>
        <ListaTermos
          termos={prefs.termosBloqueados}
          onChange={(termosBloqueados) => alterar({ termosBloqueados })}
          placeholder="ex: hdcam"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.07] p-4">
        <input
          type="checkbox"
          checked={prefs.somentePreferidos}
          onChange={(e) => alterar({ somentePreferidos: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
        />
        <span>
          <span className="block text-sm font-medium">Mostrar só o que bate com algum termo</span>
          <span className="mt-0.5 block text-xs text-ink-400">
            Desligado, tudo aparece e os preferidos só ficam no topo. Ligado, o resto some (dá pra
            ver assim mesmo na hora da busca).
          </span>
        </span>
      </label>

      {err && <ErrorBox message={err} />}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      <div className="flex gap-2">
        <button className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          className="btn-outline"
          onClick={() => data?.padroes && setPrefs({ ...prefs, ...data.padroes })}
        >
          Voltar ao padrão
        </button>
      </div>
    </div>
  );
}

function UsuariosTab() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<{ users: User[] }>('/users');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [err, setErr] = useState<string | null>(null);

  const criar = async () => {
    setErr(null);
    try {
      await api('/users', { method: 'POST', body: form });
      setForm({ name: '', email: '', password: '', role: 'viewer' });
      setOpen(false);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const apagar = async (u: User) => {
    if (!confirm(`Apagar o perfil de ${u.name}? O histórico e as playlists dele vão junto.`)) return;
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <button className="btn-primary mb-4" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Novo perfil
      </button>

      {err && <ErrorBox message={err} />}

      <div className="flex flex-col gap-2">
        {data?.users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-ink-900 p-3"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold text-white"
              style={{ background: u.accent }}
            >
              {u.name[0]?.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {u.name}
                {u.id === user?.id && <span className="ml-2 text-xs text-ink-500">(você)</span>}
              </p>
              <p className="truncate text-xs text-ink-400">
                {u.email} • {u.role === 'admin' ? 'admin' : 'visualização'} • {u.plays || 0} plays
              </p>
            </div>
            {u.id !== user?.id && (
              <button onClick={() => apagar(u)} className="icon-btn text-red-400" aria-label="Apagar perfil">
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Novo perfil"
        footer={
          <button
            className="btn-primary w-full"
            onClick={criar}
            disabled={!form.name || !form.email || form.password.length < 6}
          >
            Criar perfil
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <input
            className="field"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="field"
            type="password"
            placeholder="Senha (mínimo 6)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            className="field"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="viewer">Visualização (só assiste e ouve)</option>
            <option value="admin">Admin (sobe e edita conteúdo)</option>
          </select>
        </div>
      </Sheet>
    </div>
  );
}
