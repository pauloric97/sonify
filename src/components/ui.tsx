import { useEffect, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      {icon && <div className="text-ink-500">{icon}</div>}
      <p className="text-[15px] font-semibold text-white">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-400">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

/** Modal centralizado no desktop, bottom sheet no celular. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full animate-slide-up rounded-t-3xl border border-white/10 bg-ink-900 pb-safe sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="icon-btn -mr-2" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-white/[0.06] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/** Cabeçalho de seção com link opcional no canto. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{children}</h2>
      {action}
    </div>
  );
}

/** Carrossel horizontal com scroll-snap (bom no touch). */
export function Row({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {children}
    </div>
  );
}

/** Barrinhas animadas que indicam "tocando agora". */
export function NowPlayingBars({ paused }: { paused?: boolean }) {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-label="Tocando">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-[3px] origin-bottom rounded-full ${paused ? '' : 'animate-bar'}`}
          style={{
            height: '100%',
            background: 'var(--accent)',
            animationDelay: `${i * 0.18}s`,
            transform: paused ? 'scaleY(0.4)' : undefined,
          }}
        />
      ))}
    </span>
  );
}
