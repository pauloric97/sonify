import { useState } from 'react';
import { ChevronDown, Heart, ListMusic, MoreHorizontal } from 'lucide-react';
import { api } from '../lib/api';
import { usePlayer } from '../lib/player';
import { formatTime } from '../lib/format';
import { Cover } from './Cover';
import { Seekbar, TransportControls } from './PlayerBar';
import { MediaMenu } from './MediaMenu';

/** Player em tela cheia — o "abre a capa gigante" do celular. */
export function FullPlayer({ onOpenQueue }: { onOpenQueue: () => void }) {
  const { current, setExpanded, currentTime, duration, error } = usePlayer();
  const [menu, setMenu] = useState(false);
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
    <div className="fixed inset-0 z-40 animate-slide-up overflow-hidden bg-ink-950">
      {/* Fundo tingido pela cor da capa */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, ${current.color || '#2a2a35'} 0%, #08080b 65%)`,
        }}
      />

      <div className="relative flex h-full flex-col px-6 pb-safe pt-safe">
        <div className="flex items-center justify-between py-3">
          <button onClick={() => setExpanded(false)} className="icon-btn" aria-label="Minimizar">
            <ChevronDown className="h-6 w-6" />
          </button>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-widest text-white/50">Tocando agora</p>
            <p className="max-w-[55vw] truncate text-[13px] font-medium">{current.album || 'Sonify'}</p>
          </div>
          <button onClick={() => setMenu(true)} className="icon-btn" aria-label="Opções">
            <MoreHorizontal className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-4">
          <div className="aspect-square w-full max-w-[min(78vw,380px)] overflow-hidden rounded-2xl shadow-2xl shadow-black/60">
            <Cover cover={current.cover} color={current.color} alt={current.title} rounded="rounded-2xl" />
          </div>
        </div>

        <div className="pb-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{current.title}</h1>
              <p className="truncate text-[15px] text-white/60">{current.artist || 'Desconhecido'}</p>
            </div>
            <button
              onClick={toggleFav}
              className="icon-btn shrink-0"
              style={isFav ? { color: 'var(--accent)' } : undefined}
              aria-label="Favoritar"
            >
              <Heart className={`h-6 w-6 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>

          <Seekbar compact />
          <div className="mb-6 flex justify-between px-1 text-[11px] tabular-nums text-white/50">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
          </div>

          {error && <p className="mb-4 text-center text-sm text-red-300">{error}</p>}

          <div className="flex items-center justify-center">
            <TransportControls big />
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={onOpenQueue}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <ListMusic className="h-4 w-4" />
              Fila
            </button>
          </div>
        </div>
      </div>

      <MediaMenu media={menu ? current : null} onClose={() => setMenu(false)} />
    </div>
  );
}
