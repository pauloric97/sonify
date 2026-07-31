import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { usePlayer } from '../lib/player';
import { formatDuration, plural } from '../lib/format';
import { DetailHeader } from '../components/DetailHeader';
import { TrackList } from '../components/TrackList';
import { Empty, ErrorBox, Loading, Sheet } from '../components/ui';
import type { Media, Playlist } from '../types';

interface Data {
  playlist: Playlist;
  tracks: Media[];
}

export function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, toggleShuffle, shuffle } = usePlayer();
  const { data, loading, error, reload } = useApi<Data>(`/playlists/${id}`);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const mine = data.playlist.user_id === user?.id;
  const audio = data.tracks.filter((t) => t.kind === 'audio');

  const playAll = (random = false) => {
    if (random && !shuffle) toggleShuffle();
    play(audio, 0);
  };

  const openEdit = () => {
    setName(data.playlist.name);
    setDesc(data.playlist.description || '');
    setEditing(true);
  };

  const save = async () => {
    await api(`/playlists/${id}`, { method: 'PATCH', body: { name, description: desc } });
    setEditing(false);
    reload();
  };

  const remove = async () => {
    if (!confirm(`Apagar a playlist "${data.playlist.name}"?`)) return;
    await api(`/playlists/${id}`, { method: 'DELETE' });
    navigate('/biblioteca?tab=playlists', { replace: true });
  };

  return (
    <div className="mx-auto max-w-[1400px] pb-6">
      <DetailHeader
        title={data.playlist.name}
        cover={data.playlist.cover}
        color={data.playlist.color}
        kind="playlist"
        subtitle={data.playlist.description || undefined}
        meta={[
          `por ${data.playlist.owner}`,
          plural(data.tracks.length, 'item', 'itens'),
          formatDuration(data.tracks.reduce((s, t) => s + (t.duration || 0), 0)),
        ]
          .filter(Boolean)
          .join(' • ')}
        onPlay={audio.length ? () => playAll() : undefined}
        onShuffle={audio.length ? () => playAll(true) : undefined}
        actions={
          mine && (
            <>
              <button onClick={openEdit} className="icon-btn" aria-label="Editar playlist">
                <Pencil className="h-[18px] w-[18px]" />
              </button>
              <button onClick={remove} className="icon-btn text-red-400" aria-label="Apagar playlist">
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </>
          )
        }
      />

      {!data.tracks.length ? (
        <Empty
          title="Playlist vazia"
          hint="Use o menu (…) de qualquer faixa e escolha “Adicionar a playlist”."
        />
      ) : (
        <TrackList
          tracks={data.tracks}
          onPlay={(i) => play(data.tracks, i)}
          showAlbum
          onChanged={reload}
        />
      )}

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar playlist"
        footer={
          <button className="btn-primary w-full" onClick={save} disabled={!name.trim()}>
            Salvar
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          <input
            className="field"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descrição"
          />
        </div>
      </Sheet>
    </div>
  );
}
