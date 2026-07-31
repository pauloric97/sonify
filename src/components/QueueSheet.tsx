import { Trash2, X } from 'lucide-react';
import { usePlayer } from '../lib/player';
import { formatTime } from '../lib/format';
import { Cover } from './Cover';
import { NowPlayingBars, Sheet } from './ui';

export function QueueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { queue, current, playing, play, removeFromQueue, clear } = usePlayer();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Fila (${queue.length})`}
      footer={
        queue.length ? (
          <button
            onClick={() => {
              clear();
              onClose();
            }}
            className="btn-ghost w-full text-red-300"
          >
            <X className="h-4 w-4" />
            Limpar fila
          </button>
        ) : undefined
      }
    >
      {!queue.length && <p className="py-6 text-center text-sm text-ink-400">A fila está vazia.</p>}

      <div className="flex flex-col">
        {queue.map((track, i) => {
          const active = current?.id === track.id;
          return (
            <div
              key={`${track.id}-${i}`}
              className={`group flex items-center gap-3 rounded-xl px-2 py-2 ${active ? 'bg-white/[0.07]' : ''}`}
            >
              <button
                onClick={() => play(queue, i)}
                className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
                aria-label={`Tocar ${track.title}`}
              >
                <Cover cover={track.cover} color={track.color} alt={track.title} rounded="rounded-lg" />
              </button>
              <button onClick={() => play(queue, i)} className="min-w-0 flex-1 text-left">
                <p
                  className={`truncate text-sm ${active ? 'font-semibold' : ''}`}
                  style={active ? { color: 'var(--accent)' } : undefined}
                >
                  {track.title}
                </p>
                <p className="truncate text-xs text-ink-400">{track.artist || 'Desconhecido'}</p>
              </button>
              {active ? (
                <NowPlayingBars paused={!playing} />
              ) : (
                <span className="text-xs tabular-nums text-ink-500">{formatTime(track.duration)}</span>
              )}
              <button
                onClick={() => removeFromQueue(i)}
                className="icon-btn h-8 w-8 opacity-0 transition group-hover:opacity-100"
                aria-label="Tirar da fila"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
