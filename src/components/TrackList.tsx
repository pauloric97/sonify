import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MoreHorizontal, Play } from 'lucide-react';
import { api } from '../lib/api';
import { usePlayer } from '../lib/player';
import { episodeLabel, formatTime } from '../lib/format';
import { Cover } from './Cover';
import { NowPlayingBars } from './ui';
import { MediaMenu } from './MediaMenu';
import type { Media } from '../types';

interface Props {
  tracks: Media[];
  /** Se não vier, o clique toca a lista inteira a partir do item. */
  onPlay?: (index: number) => void;
  showCover?: boolean;
  showIndex?: boolean;
  showAlbum?: boolean;
  onChanged?: () => void;
}

export function TrackList({
  tracks,
  onPlay,
  showCover = true,
  showIndex = false,
  showAlbum = false,
  onChanged,
}: Props) {
  const { play, current, playing, toggle } = usePlayer();
  const navigate = useNavigate();
  const [menuFor, setMenuFor] = useState<Media | null>(null);
  const [favs, setFavs] = useState<Record<number, boolean>>({});

  const isFav = (m: Media) => favs[m.id] ?? Boolean(m.favorite);

  const toggleFav = async (m: Media) => {
    const next = !isFav(m);
    setFavs((f) => ({ ...f, [m.id]: next }));
    try {
      await api(`/favorites/${m.id}`, { method: 'POST' });
    } catch {
      setFavs((f) => ({ ...f, [m.id]: !next })); // desfaz se deu erro
    }
  };

  const start = (index: number) => {
    const track = tracks[index];
    // Vídeo não entra na fila de áudio: abre o player de vídeo.
    if (track.kind === 'video') return navigate(`/assistir/${track.id}`);
    if (current?.id === track.id) return toggle();
    if (onPlay) onPlay(index);
    else play(tracks, index);
  };

  return (
    <>
      <div className="flex flex-col">
        {tracks.map((track, i) => {
          const active = current?.id === track.id;
          return (
            <div
              key={track.id}
              onDoubleClick={() => start(i)}
              className={`group flex items-center gap-3 rounded-xl px-2 py-2 transition ${
                active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]'
              }`}
            >
              {showIndex && (
                <div className="w-6 shrink-0 text-center text-[13px] tabular-nums text-ink-400">
                  {active ? (
                    <span className="flex justify-center">
                      <NowPlayingBars paused={!playing} />
                    </span>
                  ) : (
                    <>
                      <span className="group-hover:hidden">{track.track_no || i + 1}</span>
                      <button
                        onClick={() => start(i)}
                        className="hidden text-white group-hover:block"
                        aria-label={`Tocar ${track.title}`}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {showCover && (
                <button
                  onClick={() => start(i)}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"
                  aria-label={`Tocar ${track.title}`}
                >
                  <Cover cover={track.cover} color={track.color} kind={track.kind} alt={track.title} rounded="rounded-lg" />
                  <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                    {active && playing ? (
                      <NowPlayingBars />
                    ) : (
                      <Play className="h-4 w-4 fill-current text-white" />
                    )}
                  </span>
                </button>
              )}

              <button onClick={() => start(i)} className="min-w-0 flex-1 text-left">
                <p className={`truncate text-[15px] ${active ? 'font-semibold' : 'font-medium'}`}
                   style={active ? { color: 'var(--accent)' } : undefined}>
                  {track.title}
                </p>
                <p className="truncate text-[13px] text-ink-400">
                  {[
                    track.kind === 'video' ? episodeLabel(track.season, track.episode) : track.artist,
                    showAlbum ? track.album : null,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Desconhecido'}
                </p>
              </button>

              <button
                onClick={() => toggleFav(track)}
                className={`icon-btn hidden h-9 w-9 sm:grid ${isFav(track) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={isFav(track) ? { color: 'var(--accent)' } : undefined}
                aria-label="Favoritar"
              >
                <Heart className={`h-[18px] w-[18px] ${isFav(track) ? 'fill-current' : ''}`} />
              </button>

              <span className="hidden w-12 shrink-0 text-right text-[13px] tabular-nums text-ink-400 sm:block">
                {formatTime(track.duration)}
              </span>

              <button
                onClick={() => setMenuFor(track)}
                className="icon-btn h-9 w-9"
                aria-label="Mais opções"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>

      <MediaMenu
        media={menuFor ? { ...menuFor, favorite: isFav(menuFor) ? 1 : 0 } : null}
        onClose={() => setMenuFor(null)}
        onChanged={onChanged}
      />
    </>
  );
}
