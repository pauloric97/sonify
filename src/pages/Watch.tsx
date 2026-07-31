import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, SkipForward } from 'lucide-react';
import { api, streamUrl } from '../lib/api';
import { usePlayer } from '../lib/player';
import { episodeLabel } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui';
import type { Media } from '../types';

export function WatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pauseForVideo } = usePlayer();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [media, setMedia] = useState<Media | null>(null);
  const [next, setNext] = useState<Media | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);

  // Áudio e vídeo ao mesmo tempo não dá.
  useEffect(() => pauseForVideo(), [pauseForVideo, id]);

  useEffect(() => {
    let alive = true;
    setMedia(null);
    setNext(null);
    setShowNext(false);
    api<{ media: Media }>(`/library/media/${id}`)
      .then(async ({ media }) => {
        if (!alive) return;
        setMedia(media);
        if (media.series) {
          const res = await api<{ episodes: Media[] }>(
            `/library/series?name=${encodeURIComponent(media.series)}`,
          );
          const i = res.episodes.findIndex((e) => e.id === media.id);
          if (alive && i >= 0 && res.episodes[i + 1]) setNext(res.episodes[i + 1]);
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const salvar = useCallback(() => {
    const video = videoRef.current;
    if (!video || !media || !video.duration) return;
    api('/progress', {
      method: 'POST',
      body: { mediaId: media.id, position: video.currentTime, duration: video.duration },
    }).catch(() => {});
  }, [media]);

  // Salva a posição a cada 10s e ao sair da página.
  useEffect(() => {
    if (!media) return;
    const timer = setInterval(salvar, 10_000);
    window.addEventListener('pagehide', salvar);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', salvar);
      salvar();
    };
  }, [media, salvar]);

  const onLoaded = () => {
    const video = videoRef.current;
    if (!video || !media) return;
    // Retoma de onde parou (com uma folguinha de 5s).
    if ((media.position || 0) > 30 && !media.completed) {
      video.currentTime = Math.max(0, (media.position || 0) - 5);
    }
    video.play().catch(() => {});
    api('/plays', { method: 'POST', body: { mediaId: media.id, ms: 0 } }).catch(() => {});
    // Mesma história do áudio: se o ingest não conseguiu ler a duração, grava agora.
    if (!media.duration && Number.isFinite(video.duration) && video.duration > 0) {
      api(`/library/media/${media.id}/duracao`, {
        method: 'POST',
        body: { duration: video.duration },
      }).catch(() => {});
    }
  };

  if (error) return <ErrorBox message={error} />;
  if (!media) return <Loading label="Abrindo vídeo…" />;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="absolute inset-x-0 top-0 z-10 flex items-start gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 pt-safe">
        <button onClick={() => navigate(-1)} className="icon-btn text-white" aria-label="Voltar">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <div className="min-w-0 pt-2">
          <p className="truncate text-[15px] font-semibold text-white">{media.title}</p>
          <p className="truncate text-[12px] text-white/60">
            {[media.series, episodeLabel(media.season, media.episode)].filter(Boolean).join(' • ')}
          </p>
        </div>
      </div>

      <video
        ref={videoRef}
        src={streamUrl(media.id)}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
        onLoadedMetadata={onLoaded}
        onPause={salvar}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          // Últimos 40s de episódio: oferece o próximo.
          if (next && v.duration && v.duration - v.currentTime < 40) setShowNext(true);
        }}
        onEnded={() => {
          salvar();
          if (next) navigate(`/assistir/${next.id}`, { replace: true });
        }}
        onError={() => setError('Não consegui reproduzir esse vídeo')}
      />

      {showNext && next && (
        <button
          onClick={() => navigate(`/assistir/${next.id}`, { replace: true })}
          className="absolute bottom-24 right-4 z-10 flex items-center gap-2 rounded-full bg-white/90 px-5 py-3 text-sm font-semibold text-black shadow-2xl transition hover:bg-white active:scale-95"
        >
          <SkipForward className="h-4 w-4 fill-current" />
          Próximo episódio
        </button>
      )}
    </div>
  );
}
