import { useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { usePlayer } from '../lib/player';
import { plural } from '../lib/format';
import { DetailHeader } from '../components/DetailHeader';
import { TrackList } from '../components/TrackList';
import { AlbumTile } from '../components/Cards';
import { ErrorBox, Loading, Row, SectionTitle } from '../components/ui';
import type { AlbumSummary, ArtistSummary, Media } from '../types';

interface Data {
  artist: ArtistSummary;
  albums: AlbumSummary[];
  tracks: Media[];
}

export function ArtistPage() {
  const [params] = useSearchParams();
  const name = params.get('name') || '';
  const { play, toggleShuffle, shuffle } = usePlayer();

  const { data, loading, error, reload } = useApi<Data>(
    `/library/artist?name=${encodeURIComponent(name)}`,
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
        title={data.artist.name}
        cover={data.tracks.find((t) => t.cover)?.cover}
        color={data.artist.color}
        circle
        meta={`${plural(data.tracks.length, 'faixa', 'faixas')} • ${plural(
          data.albums.length,
          'álbum',
          'álbuns',
        )}`}
        onPlay={() => playAll()}
        onShuffle={() => playAll(true)}
      />

      {data.albums.length > 1 && (
        <section className="mb-8">
          <SectionTitle>Álbuns</SectionTitle>
          <Row>
            {data.albums.map((a) => (
              <AlbumTile key={a.album} album={{ ...a, artist: a.artist || data.artist.name }} />
            ))}
          </Row>
        </section>
      )}

      <SectionTitle>Faixas</SectionTitle>
      <TrackList tracks={data.tracks} onPlay={(i) => play(data.tracks, i)} showAlbum onChanged={reload} />
    </div>
  );
}
