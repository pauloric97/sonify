import { Heart } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { usePlayer } from '../lib/player';
import { plural } from '../lib/format';
import { DetailHeader } from '../components/DetailHeader';
import { TrackList } from '../components/TrackList';
import { Empty, ErrorBox, Loading } from '../components/ui';
import type { Media } from '../types';

export function FavoritesPage() {
  const { play, toggleShuffle, shuffle } = usePlayer();
  const { data, loading, error, reload } = useApi<{ media: Media[] }>('/favorites');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const items = data?.media ?? [];
  const audio = items.filter((m) => m.kind === 'audio');

  if (!items.length)
    return (
      <div className="mx-auto max-w-[1400px] py-6">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Favoritos</h1>
        <Empty
          icon={<Heart className="h-9 w-9" />}
          title="Nada favoritado ainda"
          hint="Toque no coração de qualquer faixa ou vídeo pra ele aparecer aqui."
        />
      </div>
    );

  const playAll = (random = false) => {
    if (random && !shuffle) toggleShuffle();
    play(audio, 0);
  };

  return (
    <div className="mx-auto max-w-[1400px] pb-6">
      <DetailHeader
        title="Favoritos"
        color="#6a41f5"
        cover={items.find((m) => m.cover)?.cover}
        meta={plural(items.length, 'item', 'itens')}
        onPlay={audio.length ? () => playAll() : undefined}
        onShuffle={audio.length ? () => playAll(true) : undefined}
      />
      <TrackList tracks={items} showAlbum onChanged={reload} />
    </div>
  );
}
