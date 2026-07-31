import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Search as SearchIcon, X } from 'lucide-react';
import { useApi, useDebounced } from '../lib/useApi';
import { usePlayer } from '../lib/player';
import { TrackList } from '../components/TrackList';
import { AlbumTile, ArtistTile } from '../components/Cards';
import { Empty, Loading, Row, SectionTitle } from '../components/ui';
import type { AlbumSummary, ArtistSummary, Media } from '../types';

interface Results {
  media: Media[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
}

export function SearchPage() {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 280);
  const { play } = usePlayer();
  const { data, loading, reload } = useApi<Results>(
    debounced ? `/library/search?q=${encodeURIComponent(debounced)}` : null,
  );

  const audio = data?.media.filter((m) => m.kind === 'audio') ?? [];
  const videos = data?.media.filter((m) => m.kind === 'video') ?? [];
  const nothing = data && !data.media.length && !data.albums.length && !data.artists.length;

  return (
    <div className="mx-auto max-w-[1400px] py-6">
      <div className="sticky top-0 z-10 -mx-4 mb-6 bg-ink-950/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-500" />
          <input
            autoFocus
            className="field pl-11 pr-11"
            placeholder="Música, artista, álbum, série…"
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
      </div>

      {!debounced && (
        <Empty
          icon={<SearchIcon className="h-9 w-9" />}
          title="O que você quer ouvir?"
          hint="Busca na sua biblioteca por título, artista, álbum ou nome da série."
          action={
            <Link to="/explorar" className="btn-ghost mt-2">
              <Compass className="h-4 w-4" />
              Explorar novidades
            </Link>
          }
        />
      )}

      {debounced && loading && <Loading label="Procurando…" />}

      {nothing && !loading && (
        <Empty title="Nada encontrado" hint={`Nenhum resultado para "${debounced}".`} />
      )}

      {data?.artists.length ? (
        <section className="mb-8">
          <SectionTitle>Artistas</SectionTitle>
          <Row>
            {data.artists.map((a) => (
              <ArtistTile key={a.name} artist={a} />
            ))}
          </Row>
        </section>
      ) : null}

      {data?.albums.length ? (
        <section className="mb-8">
          <SectionTitle>Álbuns</SectionTitle>
          <Row>
            {data.albums.map((a) => (
              <AlbumTile key={`${a.artist}-${a.album}`} album={a} />
            ))}
          </Row>
        </section>
      ) : null}

      {audio.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Músicas</SectionTitle>
          <TrackList tracks={audio} onPlay={(i) => play(audio, i)} showAlbum onChanged={reload} />
        </section>
      )}

      {videos.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Vídeos</SectionTitle>
          <TrackList tracks={videos} onChanged={reload} />
        </section>
      )}
    </div>
  );
}
