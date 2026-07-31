import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Cover } from './Cover';
import { episodeLabel, formatTime } from '../lib/format';
import type { AlbumSummary, ArtistSummary, Media, Playlist, SeriesSummary } from '../types';

interface TileProps {
  to: string;
  cover?: string | null;
  color?: string | null;
  title: string;
  subtitle?: string;
  circle?: boolean;
  kind?: 'audio' | 'video' | 'playlist';
  wide?: boolean;
  progress?: number;
  onPlay?: (e: React.MouseEvent) => void;
}

export function Tile({
  to,
  cover,
  color,
  title,
  subtitle,
  circle,
  kind = 'audio',
  wide,
  progress,
  onPlay,
}: TileProps) {
  return (
    <Link
      to={to}
      className={`group relative shrink-0 snap-start rounded-2xl p-2.5 transition hover:bg-white/[0.06] ${
        wide ? 'w-[240px] sm:w-[280px]' : 'w-[150px] sm:w-[172px]'
      }`}
    >
      <div
        className={`relative mb-3 overflow-hidden shadow-lg shadow-black/40 ${
          circle ? 'rounded-full' : 'rounded-xl'
        } ${wide ? 'aspect-video' : 'aspect-square'}`}
      >
        <Cover
          cover={cover}
          color={color}
          alt={title}
          kind={kind}
          rounded={circle ? 'rounded-full' : 'rounded-xl'}
        />

        {onPlay && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlay(e);
            }}
            aria-label={`Tocar ${title}`}
            className="absolute bottom-2 right-2 grid h-11 w-11 translate-y-2 place-items-center rounded-full text-black opacity-0 shadow-xl transition
                       group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100 active:scale-90"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Play className="h-5 w-5 translate-x-[1px] fill-current" />
          </button>
        )}

        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div
              className="h-full"
              style={{ width: `${Math.min(100, progress * 100)}%`, background: 'var(--accent)' }}
            />
          </div>
        )}
      </div>

      <p className="truncate text-sm font-semibold">{title}</p>
      {subtitle && <p className="truncate text-[13px] text-ink-400">{subtitle}</p>}
    </Link>
  );
}

export const albumHref = (album: string, artist: string) =>
  `/album?album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`;

export const artistHref = (name: string) => `/artista?name=${encodeURIComponent(name)}`;
export const seriesHref = (name: string) => `/serie?name=${encodeURIComponent(name)}`;

export function AlbumTile({ album, onPlay }: { album: AlbumSummary; onPlay?: () => void }) {
  return (
    <Tile
      to={albumHref(album.album, album.artist)}
      cover={album.cover}
      color={album.color}
      title={album.album}
      subtitle={album.artist}
      onPlay={onPlay ? () => onPlay() : undefined}
    />
  );
}

export function ArtistTile({ artist }: { artist: ArtistSummary }) {
  return (
    <Tile
      to={artistHref(artist.name)}
      cover={artist.cover}
      color={artist.color}
      title={artist.name}
      subtitle={`${artist.tracks} ${artist.tracks === 1 ? 'faixa' : 'faixas'}`}
      circle
    />
  );
}

export function SeriesTile({ series }: { series: SeriesSummary }) {
  return (
    <Tile
      to={seriesHref(series.name)}
      cover={series.cover}
      color={series.color}
      title={series.name}
      subtitle={`${series.episodes} ${series.episodes === 1 ? 'episódio' : 'episódios'}`}
      kind="video"
    />
  );
}

export function PlaylistTile({ playlist }: { playlist: Playlist }) {
  return (
    <Tile
      to={`/playlist/${playlist.id}`}
      cover={playlist.cover}
      color={playlist.color}
      title={playlist.name}
      subtitle={`${playlist.items} ${playlist.items === 1 ? 'item' : 'itens'} • ${playlist.owner}`}
      kind="playlist"
    />
  );
}

/** Card de mídia solta — serve pra faixa, filme e episódio. */
export function MediaTile({ media, onPlay }: { media: Media; onPlay?: () => void }) {
  const isVideo = media.kind === 'video';
  const sub = isVideo
    ? [media.series, episodeLabel(media.season, media.episode)].filter(Boolean).join(' • ') ||
      formatTime(media.duration)
    : media.artist || 'Desconhecido';

  return (
    <Tile
      to={isVideo ? `/assistir/${media.id}` : albumHref(media.album || 'Sem álbum', media.album_artist || media.artist || 'Artista desconhecido')}
      cover={media.cover}
      color={media.color}
      title={media.title}
      subtitle={sub}
      kind={media.kind}
      wide={isVideo}
      progress={media.duration && media.position ? media.position / media.duration : undefined}
      onPlay={onPlay && !isVideo ? () => onPlay() : undefined}
    />
  );
}
