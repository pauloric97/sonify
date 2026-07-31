import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3, Heart, ListPlus, Loader2, Pencil, Play, Plus, Search, Sparkles, Trash2, User,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePlayer } from '../lib/player';
import { Cover } from './Cover';
import { ErrorBox, Sheet } from './ui';
import { albumHref, artistHref } from './Cards';
import type { Candidato, Media, Playlist } from '../types';

interface Props {
  media: Media | null;
  onClose: () => void;
  onChanged?: () => void;
}

/** Menu de ações de um item — bottom sheet no celular, modal no desktop. */
export function MediaMenu({ media, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const { addToQueue, playNow } = usePlayer();
  const navigate = useNavigate();
  const [view, setView] = useState<'menu' | 'playlists' | 'edit' | 'sugestoes'>('menu');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (media) {
      setView('menu');
      setError(null);
    }
  }, [media]);

  if (!media) return null;

  const isAudio = media.kind === 'audio';

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChanged?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const title =
    view === 'playlists'
      ? 'Adicionar a playlist'
      : view === 'edit'
        ? 'Editar informações'
        : view === 'sugestoes'
          ? 'Buscar capa e dados'
          : media.title;

  return (
    <Sheet open onClose={onClose} title={title}>
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      )}

      {view === 'menu' && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
              <Cover cover={media.cover} color={media.color} kind={media.kind} alt={media.title} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{media.title}</p>
              <p className="truncate text-sm text-ink-400">
                {media.artist || media.series || 'Sem artista'}
              </p>
            </div>
          </div>

          <div className="flex flex-col">
            {isAudio && (
              <MenuItem
                icon={<Play className="h-[18px] w-[18px]" />}
                label="Tocar agora"
                onClick={() => {
                  playNow(media);
                  onClose();
                }}
              />
            )}
            {isAudio && (
              <MenuItem
                icon={<ListPlus className="h-[18px] w-[18px]" />}
                label="Tocar em seguida"
                onClick={() => {
                  addToQueue(media);
                  onClose();
                }}
              />
            )}
            <MenuItem
              icon={<Plus className="h-[18px] w-[18px]" />}
              label="Adicionar a playlist"
              onClick={() => setView('playlists')}
            />
            <MenuItem
              icon={
                <Heart className={`h-[18px] w-[18px] ${media.favorite ? 'fill-current' : ''}`} />
              }
              label={media.favorite ? 'Remover dos favoritos' : 'Favoritar'}
              onClick={() => act(() => api(`/favorites/${media.id}`, { method: 'POST' }))}
            />
            {isAudio && media.album && (
              <MenuItem
                icon={<Disc3 className="h-[18px] w-[18px]" />}
                label="Ir para o álbum"
                onClick={() => {
                  navigate(albumHref(media.album!, media.album_artist || media.artist || 'Artista desconhecido'));
                  onClose();
                }}
              />
            )}
            {isAudio && media.artist && (
              <MenuItem
                icon={<User className="h-[18px] w-[18px]" />}
                label="Ir para o artista"
                onClick={() => {
                  navigate(artistHref(media.artist!));
                  onClose();
                }}
              />
            )}
            {user?.role === 'admin' && (
              <>
                <MenuItem
                  icon={<Sparkles className="h-[18px] w-[18px]" />}
                  label="Buscar capa e dados"
                  onClick={() => setView('sugestoes')}
                />
                <MenuItem
                  icon={<Pencil className="h-[18px] w-[18px]" />}
                  label="Editar informações"
                  onClick={() => setView('edit')}
                />
                <MenuItem
                  icon={<Trash2 className="h-[18px] w-[18px]" />}
                  label="Remover da biblioteca"
                  danger
                  onClick={() => {
                    if (!confirm(`Remover "${media.title}" da biblioteca?\n\nO arquivo continua no bucket.`)) return;
                    act(() => api(`/library/media/${media.id}`, { method: 'DELETE' }));
                  }}
                />
              </>
            )}
          </div>
        </>
      )}

      {view === 'playlists' && <PlaylistPicker media={media} onDone={onClose} onError={setError} />}

      {view === 'sugestoes' && (
        <Sugestoes
          media={media}
          onDone={() => {
            onChanged?.();
            onClose();
          }}
          onError={setError}
        />
      )}

      {view === 'edit' && (
        <EditForm
          media={media}
          onSaved={() => {
            onChanged?.();
            onClose();
          }}
          onError={setError}
        />
      )}
    </Sheet>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3.5 rounded-xl px-2 py-3 text-left text-[15px] transition hover:bg-white/[0.07] ${
        danger ? 'text-red-400' : 'text-white'
      }`}
    >
      <span className={danger ? 'text-red-400' : 'text-ink-300'}>{icon}</span>
      {label}
    </button>
  );
}

function PlaylistPicker({
  media,
  onDone,
  onError,
}: {
  media: Media;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [name, setName] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    api<{ playlists: Playlist[] }>('/playlists')
      .then((r) => setPlaylists(r.playlists.filter((p) => p.user_id === user?.id)))
      .catch((e) => onError(e.message));
  }, [user?.id, onError]);

  const add = async (playlistId: number) => {
    try {
      await api(`/playlists/${playlistId}/items`, { method: 'POST', body: { mediaId: media.id } });
      onDone();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      const res = await api<{ playlist: Playlist }>('/playlists', { method: 'POST', body: { name } });
      await add(res.playlist.id);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2 flex gap-2">
        <input
          className="field"
          placeholder="Criar nova playlist…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn-primary shrink-0" onClick={create} disabled={!name.trim()}>
          Criar
        </button>
      </div>

      {playlists?.map((p) => (
        <button
          key={p.id}
          onClick={() => add(p.id)}
          className="flex items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.07]"
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
            <Cover cover={p.cover} color={p.color} kind="playlist" alt={p.name} rounded="rounded-lg" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="text-xs text-ink-400">{p.items} itens</p>
          </div>
        </button>
      ))}

      {playlists && !playlists.length && (
        <p className="py-4 text-center text-sm text-ink-400">Você ainda não tem playlists.</p>
      )}
    </div>
  );
}

/** Busca no iTunes/Deezer/TMDB e deixa o admin escolher qual resultado aplicar. */
function Sugestoes({
  media,
  onDone,
  onError,
}: {
  media: Media;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const inicial =
    media.kind === 'video'
      ? [media.series, media.title].filter(Boolean).join(' ')
      : [media.artist, media.title].filter(Boolean).join(' ');

  const [q, setQ] = useState(inicial);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aplicando, setAplicando] = useState<number | null>(null);

  const buscar = async (termo?: string) => {
    setBuscando(true);
    setCandidatos(null);
    try {
      const res = await api<{ candidatos: Candidato[]; aviso: string | null }>(
        `/library/media/${media.id}/sugestoes${termo ? `?q=${encodeURIComponent(termo)}` : ''}`,
      );
      setCandidatos(res.candidatos);
      setAviso(res.aviso);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id]);

  const aplicar = async (candidato: Candidato, i: number) => {
    setAplicando(i);
    try {
      await api(`/library/media/${media.id}/aplicar`, { method: 'POST', body: { candidato } });
      onDone();
    } catch (e) {
      onError((e as Error).message);
      setAplicando(null);
    }
  };

  const legenda = (c: Candidato) =>
    c.subtitulo ||
    [c.artist, c.album, c.year].filter(Boolean).join(' • ') ||
    String(c.year || '');

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            className="field pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar(q)}
            placeholder="Refine a busca…"
          />
        </div>
        <button className="btn-ghost shrink-0" onClick={() => buscar(q)} disabled={buscando}>
          Buscar
        </button>
      </div>

      {aviso && <p className="mb-3 text-xs text-amber-300">{aviso}</p>}

      {buscando && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Procurando…
        </div>
      )}

      {candidatos && !candidatos.length && !buscando && (
        <p className="py-8 text-center text-sm text-ink-400">
          Nada encontrado. Tenta escrever o nome do artista junto.
        </p>
      )}

      <div className="flex flex-col gap-1">
        {candidatos?.map((c, i) => (
          <button
            key={`${c.fonte}-${i}`}
            onClick={() => aplicar(c, i)}
            disabled={aplicando !== null}
            className="flex items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-800">
              {c.thumb ? (
                <img src={c.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.title}</p>
              <p className="truncate text-xs text-ink-400">{legenda(c)}</p>
            </div>
            {aplicando === i ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-400" />
            ) : (
              <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-medium text-ink-300">
                {c.fonte}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const AUDIO_FIELDS = [
  ['title', 'Título'],
  ['artist', 'Artista'],
  ['album', 'Álbum'],
  ['album_artist', 'Artista do álbum'],
  ['genre', 'Gênero'],
  ['year', 'Ano'],
  ['track_no', 'Faixa nº'],
] as const;

const VIDEO_FIELDS = [
  ['title', 'Título'],
  ['series', 'Série/coleção'],
  ['season', 'Temporada'],
  ['episode', 'Episódio'],
  ['year', 'Ano'],
] as const;

function EditForm({
  media,
  onSaved,
  onError,
}: {
  media: Media;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const fields = media.kind === 'video' ? VIDEO_FIELDS : AUDIO_FIELDS;
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(([k]) => [k, (media as any)[k] ?? ''])),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const [k] of fields) {
        const v = form[k]?.trim?.() ?? '';
        body[k] = ['year', 'track_no', 'season', 'episode'].includes(k) ? (v ? Number(v) : null) : v || null;
      }
      await api(`/library/media/${media.id}`, { method: 'PATCH', body });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {fields.map(([key, label]) => (
        <label key={key} className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
            {label}
          </span>
          <input
            className="field"
            value={form[key] ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </label>
      ))}
      <button className="btn-primary mt-2 w-full" onClick={save} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  );
}
