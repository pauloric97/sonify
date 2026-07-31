import { useState } from 'react';
import {
  ChevronUp, Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
  Volume1, Volume2, VolumeX,
} from 'lucide-react';
import { api } from '../lib/api';
import { usePlayer } from '../lib/player';
import { formatTime } from '../lib/format';
import { Cover } from './Cover';
import { FullPlayer } from './FullPlayer';
import { QueueSheet } from './QueueSheet';

export function Seekbar({ compact }: { compact?: boolean }) {
  const { currentTime, duration, seek } = usePlayer();
  const [dragging, setDragging] = useState<number | null>(null);
  const value = dragging ?? currentTime;
  const max = duration || 0;
  const pct = max ? (value / max) * 100 : 0;

  return (
    <div className={`flex w-full items-center gap-2 ${compact ? '' : 'px-1'}`}>
      {!compact && (
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-ink-400">
          {formatTime(value)}
        </span>
      )}
      <input
        type="range"
        min={0}
        max={max || 1}
        step={0.5}
        value={value}
        aria-label="Progresso"
        style={{ ['--pct' as string]: `${pct}%` }}
        className="h-4 w-full"
        onChange={(e) => setDragging(Number(e.target.value))}
        onPointerUp={(e) => {
          seek(Number((e.target as HTMLInputElement).value));
          setDragging(null);
        }}
        onKeyUp={(e) => {
          seek(Number((e.target as HTMLInputElement).value));
          setDragging(null);
        }}
      />
      {!compact && (
        <span className="w-10 shrink-0 text-[11px] tabular-nums text-ink-400">{formatTime(max)}</span>
      )}
    </div>
  );
}

export function PlayPauseButton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { playing, toggle, loading } = usePlayer();
  const dims = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const icon = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      onClick={toggle}
      aria-label={playing ? 'Pausar' : 'Tocar'}
      className={`${dims} grid shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-90 ${
        loading ? 'opacity-70' : ''
      }`}
    >
      {playing ? (
        <Pause className={`${icon} fill-current`} />
      ) : (
        <Play className={`${icon} translate-x-[1px] fill-current`} />
      )}
    </button>
  );
}

export function TransportControls({ big }: { big?: boolean }) {
  const { next, prev, shuffle, toggleShuffle, repeat, cycleRepeat } = usePlayer();
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <div className={`flex items-center ${big ? 'gap-5' : 'gap-2'}`}>
      <button
        onClick={toggleShuffle}
        className="icon-btn"
        style={shuffle ? { color: 'var(--accent)' } : undefined}
        aria-label="Aleatório"
      >
        <Shuffle className="h-[18px] w-[18px]" />
      </button>
      <button onClick={prev} className="icon-btn text-white" aria-label="Anterior">
        <SkipBack className={big ? 'h-7 w-7 fill-current' : 'h-5 w-5 fill-current'} />
      </button>
      <PlayPauseButton size={big ? 'lg' : 'md'} />
      <button onClick={next} className="icon-btn text-white" aria-label="Próxima">
        <SkipForward className={big ? 'h-7 w-7 fill-current' : 'h-5 w-5 fill-current'} />
      </button>
      <button
        onClick={cycleRepeat}
        className="icon-btn"
        style={repeat !== 'off' ? { color: 'var(--accent)' } : undefined}
        aria-label="Repetir"
      >
        <RepeatIcon className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

function VolumeControl() {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const Icon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <button onClick={toggleMute} className="icon-btn h-9 w-9" aria-label="Mudo">
        <Icon className="h-[18px] w-[18px]" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        style={{ ['--pct' as string]: `${(muted ? 0 : volume) * 100}%` }}
        className="h-4 w-24"
      />
    </div>
  );
}

export function PlayerBar() {
  const { current, expanded, setExpanded } = usePlayer();
  const [queueOpen, setQueueOpen] = useState(false);
  const [fav, setFav] = useState<boolean | null>(null);

  if (!current) return null;
  const isFav = fav ?? Boolean(current.favorite);

  const toggleFav = async () => {
    setFav(!isFav);
    try {
      await api(`/favorites/${current.id}`, { method: 'POST' });
    } catch {
      setFav(isFav);
    }
  };

  return (
    <>
      {/* ---------------- celular: mini player ---------------- */}
      <div className="fixed inset-x-0 bottom-[64px] z-30 px-2 md:hidden">
        <div
          onClick={() => setExpanded(true)}
          className="flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-ink-850/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
            <Cover cover={current.cover} color={current.color} alt={current.title} rounded="rounded-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{current.title}</p>
            <p className="truncate text-[12px] text-ink-400">{current.artist || 'Desconhecido'}</p>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 pr-1">
            <PlayPauseButton size="sm" />
          </div>
          <ChevronUp className="mr-1 h-4 w-4 shrink-0 text-ink-500" />
        </div>
      </div>

      {/* ---------------- desktop: barra completa ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 hidden h-[88px] border-t border-white/[0.07] bg-ink-900/95 backdrop-blur-xl md:block">
        <div className="mx-auto grid h-full max-w-[1600px] grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="h-14 w-14 shrink-0 overflow-hidden rounded-lg transition hover:opacity-80"
              aria-label="Abrir player"
            >
              <Cover cover={current.cover} color={current.color} alt={current.title} rounded="rounded-lg" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{current.title}</p>
              <p className="truncate text-[13px] text-ink-400">{current.artist || 'Desconhecido'}</p>
            </div>
            <button
              onClick={toggleFav}
              className="icon-btn h-9 w-9"
              style={isFav ? { color: 'var(--accent)' } : undefined}
              aria-label="Favoritar"
            >
              <Heart className={`h-[18px] w-[18px] ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <TransportControls />
            <Seekbar />
          </div>

          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setQueueOpen(true)}
              className="icon-btn h-9 w-9"
              aria-label="Fila"
            >
              <ListMusic className="h-[18px] w-[18px]" />
            </button>
            <VolumeControl />
          </div>
        </div>
      </div>

      {expanded && <FullPlayer onOpenQueue={() => setQueueOpen(true)} />}
      <QueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} />
    </>
  );
}
