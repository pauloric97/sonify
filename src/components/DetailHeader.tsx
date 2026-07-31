import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Play, Shuffle } from 'lucide-react';
import { Cover } from './Cover';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  meta?: string;
  cover?: string | null;
  color?: string | null;
  kind?: 'audio' | 'video' | 'playlist';
  circle?: boolean;
  onPlay?: () => void;
  onShuffle?: () => void;
  actions?: ReactNode;
}

/** Cabeçalho das páginas de álbum/artista/playlist/série. */
export function DetailHeader({
  title,
  subtitle,
  meta,
  cover,
  color,
  kind = 'audio',
  circle,
  onPlay,
  onShuffle,
  actions,
}: Props) {
  const navigate = useNavigate();

  return (
    <header className="relative -mx-4 mb-6 px-4 pb-4 pt-3 sm:-mx-6 sm:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] opacity-70"
        style={{
          background: `linear-gradient(180deg, ${color || '#2a2a35'} -20%, rgba(8,8,11,0) 100%)`,
        }}
      />

      <div className="relative">
        <button onClick={() => navigate(-1)} className="icon-btn -ml-2 mb-3" aria-label="Voltar">
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
          <div
            className={`h-[168px] w-[168px] shrink-0 overflow-hidden shadow-2xl shadow-black/50 sm:h-[200px] sm:w-[200px] ${
              circle ? 'rounded-full' : 'rounded-2xl'
            }`}
          >
            <Cover
              cover={cover}
              color={color}
              alt={title}
              kind={kind}
              rounded={circle ? 'rounded-full' : 'rounded-2xl'}
            />
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-white/70">{subtitle}</p>}
            {meta && <p className="mt-1 text-[13px] text-white/50">{meta}</p>}

            <div className="mt-5 flex items-center justify-center gap-2 sm:justify-start">
              {onPlay && (
                <button className="btn-primary px-7 py-3" onClick={onPlay}>
                  <Play className="h-4 w-4 fill-current" />
                  Tocar
                </button>
              )}
              {onShuffle && (
                <button className="btn-outline px-5 py-3" onClick={onShuffle}>
                  <Shuffle className="h-4 w-4" />
                  Aleatório
                </button>
              )}
              {actions}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
