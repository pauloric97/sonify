import { Disc3, Film, ListMusic } from 'lucide-react';
import { coverUrl } from '../lib/api';

interface Props {
  cover?: string | null;
  color?: string | null;
  alt?: string;
  kind?: 'audio' | 'video' | 'playlist';
  className?: string;
  rounded?: string;
}

/** Capa da tag do arquivo; sem capa, cai num degradê determinístico + ícone. */
export function Cover({ cover, color, alt = '', kind = 'audio', className = '', rounded = 'rounded-xl' }: Props) {
  const src = coverUrl(cover);
  const base = color || '#2a2a35';

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${rounded} h-full w-full bg-ink-800 object-cover ${className}`}
      />
    );
  }

  const Icon = kind === 'video' ? Film : kind === 'playlist' ? ListMusic : Disc3;

  return (
    <div
      className={`${rounded} grid h-full w-full place-items-center ${className}`}
      style={{ background: `linear-gradient(140deg, ${base}, ${base}22 65%, #16161d)` }}
      aria-label={alt}
    >
      <Icon className="h-[28%] w-[28%] text-white/30" strokeWidth={1.5} />
    </div>
  );
}
