import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Music2, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { usePlayer } from '../lib/player';
import { TrackList } from '../components/TrackList';
import { AlbumTile, ArtistTile, PlaylistTile } from '../components/Cards';
import { Empty, ErrorBox, Loading, Sheet } from '../components/ui';
import { Fab } from '../components/AppShell';
import type { AlbumSummary, ArtistSummary, Media, Playlist } from '../types';

const TABS = [
  { id: 'faixas', label: 'Faixas' },
  { id: 'albuns', label: 'Álbuns' },
  { id: 'artistas', label: 'Artistas' },
  { id: 'playlists', label: 'Playlists' },
];

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'faixas';

  return (
    <div className="mx-auto max-w-[1400px] py-6">
      <h1 className="mb-5 text-3xl font-bold tracking-tight">Biblioteca</h1>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams(t.id === 'faixas' ? {} : { tab: t.id })}
            className={`chip shrink-0 ${
              tab === t.id ? 'text-white' : 'bg-white/[0.07] text-ink-300 hover:bg-white/[0.12]'
            }`}
            style={tab === t.id ? { background: 'var(--accent)' } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'faixas' && <TracksTab />}
      {tab === 'albuns' && <AlbumsTab />}
      {tab === 'artistas' && <ArtistsTab />}
      {tab === 'playlists' && <PlaylistsTab />}
    </div>
  );
}

function TracksTab() {
  const { play } = usePlayer();
  const { data, loading, error, reload } = useApi<{ tracks: Media[] }>('/library/tracks');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data?.tracks.length)
    return <Empty icon={<Music2 className="h-9 w-9" />} title="Nenhuma faixa por aqui ainda" />;

  return (
    <>
      <button className="btn-primary mb-4" onClick={() => play(data.tracks, 0)}>
        Tocar tudo ({data.tracks.length})
      </button>
      <TrackList tracks={data.tracks} onPlay={(i) => play(data.tracks, i)} showAlbum onChanged={reload} />
    </>
  );
}

function AlbumsTab() {
  const { data, loading, error } = useApi<{ albums: AlbumSummary[] }>('/library/albums');
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data?.albums.length) return <Empty title="Nenhum álbum ainda" />;

  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {data.albums.map((a) => (
        <div key={`${a.artist}-${a.album}`} className="w-full">
          <AlbumTile album={a} />
        </div>
      ))}
    </div>
  );
}

function ArtistsTab() {
  const { data, loading, error } = useApi<{ artists: ArtistSummary[] }>('/library/artists');
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data?.artists.length) return <Empty title="Nenhum artista ainda" />;

  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {data.artists.map((a) => (
        <ArtistTile key={a.name} artist={a} />
      ))}
    </div>
  );
}

function PlaylistsTab() {
  const { data, loading, error, reload } = useApi<{ playlists: Playlist[] }>('/playlists');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api('/playlists', { method: 'POST', body: { name, description: desc } });
      setName('');
      setDesc('');
      setOpen(false);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  return (
    <>
      <button className="btn-ghost mb-4 hidden md:inline-flex" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nova playlist
      </button>

      {!data?.playlists.length ? (
        <Empty
          title="Nenhuma playlist ainda"
          hint="Crie uma e vá jogando as músicas dentro pelo menu de cada faixa."
          action={
            <button className="btn-primary mt-2" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Criar playlist
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.playlists.map((p) => (
            <PlaylistTile key={p.id} playlist={p} />
          ))}
        </div>
      )}

      <Fab onClick={() => setOpen(true)} label="Nova playlist" />

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nova playlist"
        footer={
          <button className="btn-primary w-full" onClick={create} disabled={!name.trim()}>
            Criar
          </button>
        }
      >
        {err && <ErrorBox message={err} />}
        <div className="flex flex-col gap-3">
          <input
            className="field"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="field"
            placeholder="Descrição (opcional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
      </Sheet>
    </>
  );
}
