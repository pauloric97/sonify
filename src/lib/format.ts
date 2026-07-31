/** 195 -> "3:15" | 3725 -> "1:02:05" */
export function formatTime(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Duração longa em texto: "1 h 12 min" */
export function formatDuration(seconds?: number | null): string {
  if (!seconds) return '';
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/** Legenda de episódio: "T1 • E4" */
export function episodeLabel(season?: number | null, episode?: number | null): string {
  const parts: string[] = [];
  if (season) parts.push(`T${season}`);
  if (episode) parts.push(`E${episode}`);
  return parts.join(' • ');
}
