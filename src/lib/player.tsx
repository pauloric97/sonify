import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, coverUrl, streamUrl } from './api';
import type { Media } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerValue {
  queue: Media[];
  current: Media | null;
  index: number;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  expanded: boolean;
  error: string | null;
  play: (list: Media[], startIndex?: number) => void;
  playNow: (media: Media) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setExpanded: (v: boolean) => void;
  addToQueue: (media: Media | Media[]) => void;
  removeFromQueue: (index: number) => void;
  clear: () => void;
  /** Usado pela página de vídeo pra não tocar áudio e vídeo ao mesmo tempo. */
  pauseForVideo: () => void;
}

const PlayerContext = createContext<PlayerValue | null>(null);

const VOL_KEY = 'sonify.volume';

const shuffled = (n: number, first?: number) => {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (first !== undefined) {
    const at = arr.indexOf(first);
    if (at > 0) [arr[0], arr[at]] = [arr[at], arr[0]];
  }
  return arr;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const [queue, setQueue] = useState<Media[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => Number(localStorage.getItem(VOL_KEY) ?? 1));
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const index = order[pos] ?? -1;
  const current = queue[index] ?? null;

  // Contabiliza a reprodução uma única vez por faixa.
  const playedRef = useRef({ id: 0, ms: 0, logged: false });
  // Espelhos pra usar dentro dos listeners do <audio> sem closure velha.
  const repeatRef = useRef(repeat);
  const posRef = useRef(pos);
  const orderRef = useRef(order);
  const curRef = useRef<Media | null>(null);
  repeatRef.current = repeat;
  posRef.current = pos;
  orderRef.current = order;
  curRef.current = current;

  /* --------------------------------------------------------- controles */

  const play = useCallback((list: Media[], startIndex = 0) => {
    const target = list[startIndex];
    // Vídeo não entra na fila de áudio — o índice é recalculado depois de filtrar.
    const audio = list.filter((m) => m.kind === 'audio');
    if (!audio.length) return;
    const found = target ? audio.findIndex((m) => m.id === target.id) : -1;
    const start = found >= 0 ? found : Math.max(0, Math.min(startIndex, audio.length - 1));
    setQueue(audio);
    setOrder(shuffle ? shuffled(audio.length, start) : Array.from({ length: audio.length }, (_, i) => i));
    setPos(shuffle ? 0 : start);
    setPlaying(true);
    setError(null);
  }, [shuffle]);

  const playNow = useCallback((media: Media) => play([media], 0), [play]);

  const toggle = useCallback(() => {
    if (!current) return;
    setPlaying((p) => !p);
  }, [current]);

  /** Avança uma faixa respeitando o modo de repetição. */
  const advance = useCallback(() => {
    const p = posRef.current;
    const total = orderRef.current.length;
    if (p + 1 < total) setPos(p + 1);
    else if (repeatRef.current === 'all' && total) setPos(0);
    else setPlaying(false); // acabou a fila
  }, []);

  const next = advance;

  const prev = useCallback(() => {
    const audio = audioRef.current;
    // Igual Spotify: se já passou de 4s, volta pro começo da faixa.
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    setPos((p) => (p > 0 ? p - 1 : 0));
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 0));
    setCurrentTime(audio.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    setMuted(clamped === 0);
    localStorage.setItem(VOL_KEY, String(clamped));
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const toggleShuffle = useCallback(() => {
    const on = !shuffle;
    const playingIndex = order[pos] ?? 0;
    if (on) {
      // Embaralha o resto mantendo a faixa atual na frente.
      setOrder(shuffled(queue.length, playingIndex));
      setPos(0);
    } else {
      setOrder(Array.from({ length: queue.length }, (_, i) => i));
      setPos(playingIndex);
    }
    setShuffle(on);
  }, [shuffle, order, pos, queue.length]);

  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    [],
  );

  const addToQueue = useCallback((media: Media | Media[]) => {
    const list = (Array.isArray(media) ? media : [media]).filter((m) => m.kind === 'audio');
    if (!list.length) return;
    setQueue((q) => [...q, ...list]);
    setOrder((o) => [...o, ...list.map((_, i) => queue.length + i)]);
  }, [queue.length]);

  const removeFromQueue = useCallback((queueIndex: number) => {
    setQueue((q) => q.filter((_, i) => i !== queueIndex));
    setOrder((o) =>
      o.filter((i) => i !== queueIndex).map((i) => (i > queueIndex ? i - 1 : i)),
    );
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
    setOrder([]);
    setPos(0);
    setPlaying(false);
    setExpanded(false);
  }, []);

  const pauseForVideo = useCallback(() => setPlaying(false), []);

  /* ------------------------------------------------------- efeitos <audio> */

  // Troca de faixa: aponta o src pro endpoint de streaming.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = streamUrl(current.id);
    audio.load();
    setCurrentTime(0);
    setDuration(current.duration || 0);
    setError(null);
    playedRef.current = { id: current.id, ms: 0, logged: false };
    if (playing) audio.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (playing) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing, current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastTick = 0;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      // Conta tempo ouvido pra registrar o play depois de 25s.
      const now = performance.now();
      if (lastTick) playedRef.current.ms += Math.min(now - lastTick, 2000);
      lastTick = now;
      if (!playedRef.current.logged && playedRef.current.ms > 25_000 && playedRef.current.id) {
        playedRef.current.logged = true;
        api('/plays', { method: 'POST', body: { mediaId: playedRef.current.id, ms: playedRef.current.ms } }).catch(
          () => {},
        );
      }
    };
    const onMeta = () => {
      setDuration(audio.duration || 0);
      // Arquivo cuja duração não deu pra ler no ingest: agora dá, então grava.
      const id = playedRef.current.id;
      if (id && !curRef.current?.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
        api(`/library/media/${id}/duracao`, { method: 'POST', body: { duration: audio.duration } }).catch(
          () => {},
        );
      }
    };
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setError('Não consegui tocar esse arquivo');
    };
    const onEnded = () => {
      if (repeatRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      advance();
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [advance]);

  /* ------------------------------------------------ Media Session (lockscreen) */

  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    const art = coverUrl(current.cover);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist || 'Desconhecido',
      album: current.album || 'Sonify',
      artwork: art
        ? [
            { src: art, sizes: '512x512', type: 'image/jpeg' },
            { src: art, sizes: '256x256', type: 'image/jpeg' },
          ]
        : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
  }, [current]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => setPlaying(true));
    ms.setActionHandler('pause', () => setPlaying(false));
    ms.setActionHandler('previoustrack', prev);
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('seekto', (d) => d.seekTime != null && seek(d.seekTime));
    ms.setActionHandler('seekbackward', () => seek((audioRef.current?.currentTime || 0) - 10));
    ms.setActionHandler('seekforward', () => seek((audioRef.current?.currentTime || 0) + 10));
    return () => {
      ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'].forEach(
        (a) => ms.setActionHandler(a as MediaSessionAction, null),
      );
    };
  }, [next, prev, seek]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  /* ------------------------------------------------------------ atalhos */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowRight' && e.shiftKey) next();
      else if (e.code === 'ArrowLeft' && e.shiftKey) prev();
      else if (e.code === 'ArrowRight') seek((audioRef.current?.currentTime || 0) + 10);
      else if (e.code === 'ArrowLeft') seek((audioRef.current?.currentTime || 0) - 10);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, next, prev, seek]);

  const value = useMemo<PlayerValue>(
    () => ({
      queue,
      current,
      index,
      playing,
      loading,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      expanded,
      error,
      play,
      playNow,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      setExpanded,
      addToQueue,
      removeFromQueue,
      clear,
      pauseForVideo,
    }),
    [
      queue, current, index, playing, loading, currentTime, duration, volume, muted, shuffle,
      repeat, expanded, error, play, playNow, toggle, next, prev, seek, setVolume, toggleMute,
      toggleShuffle, cycleRepeat, addToQueue, removeFromQueue, clear, pauseForVideo,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer fora do PlayerProvider');
  return ctx;
}
