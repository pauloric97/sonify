import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { usePlayer } from '../lib/player';
import { formatDuration, plural } from '../lib/format';
import { DetailHeader } from '../components/DetailHeader';
import { TrackList } from '../components/TrackList';
import { ErrorBox, Loading } from '../components/ui';
import { artistHref } from '../components/Cards';
import type { AlbumSummary, Media } from '../types';

interface Data {
  album: AlbumSummary & { duration: number };
  tracks: Media[];
}

export function AlbumPage() {
  const [params] = useSearchParams();
  const album = params.get('album') || '';
  const artist = params.get('artist') || '';
  const { play, toggleShuffle, shuffle } = usePlayer();

  const { data, loading, error, reload } = useApi<Data>(
    `/library/album?album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const playAll = (random = false) => {
    if (random && !shuffle) toggleShuffle();
    play(data.tracks, 0);
  };

  return (
    <div className="mx-auto max-w-[1400px] pb-6">
      <DetailHeader
        title={data.album.album}
        cover={data.album.cover}
        color={data.album.color}
        subtitle={
          <Link to={artistHref(data.album.artist)} className="font-semibold hover:underline">
            {data.album.artist}
          </Link>
        }
        meta={[
          data.album.year || null,
          plural(data.tracks.length, 'faixa', 'faixas'),
          formatDuration(data.album.duration),
        ]
          .filter(Boolean)
          .join(' • ')}
        onPlay={() => playAll()}
        onShuffle={() => playAll(true)}
      />

      <TrackList
        tracks={data.tracks}
        onPlay={(i) => play(data.tracks, i)}
        showIndex
        showCover={false}
        onChanged={reload}
      />
    </div>
  );
}
