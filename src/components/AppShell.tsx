import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Clapperboard, Compass, Download, Heart, Home, Library, ListPlus, Plus, Search, Settings, Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePlayer } from '../lib/player';
import { PlayerBar } from './PlayerBar';
import { Cover } from './Cover';
import type { Playlist } from '../types';

const NAV = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/buscar', label: 'Buscar', icon: Search },
  { to: '/biblioteca', label: 'Biblioteca', icon: Library },
  { to: '/videos', label: 'Vídeos', icon: Clapperboard },
];

// No celular o Explorar entra pela tela de Buscar (a barra de abas já tem 5 itens).
const NAV_EXTRA = [
  { to: '/explorar', label: 'Explorar', icon: Compass },
  { to: '/favoritos', label: 'Favoritos', icon: Heart },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2 py-1">
      <span
        className="grid h-8 w-8 place-items-center rounded-lg text-white"
        style={{ background: 'linear-gradient(140deg,#7c5cff,#e84ab2)' }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M8 5.5 19 12 8 18.5z" />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-tight">Sonify</span>
    </Link>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { current, expanded } = usePlayer();
  const location = useLocation();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    api<{ playlists: Playlist[] }>('/playlists')
      .then((r) => setPlaylists(r.playlists))
      .catch(() => {});
  }, [location.pathname]);

  // Sobe pro topo ao trocar de página (senão o scroll fica preso no meio).
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  return (
    <div className="flex h-full">
      {/* ------------------------------- sidebar (desktop) */}
      <aside className="hidden w-[248px] shrink-0 flex-col gap-1 border-r border-white/[0.06] bg-ink-950 p-3 md:flex">
        <div className="mb-4 mt-1">
          <Logo />
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${
                  isActive ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              <Icon className="h-[19px] w-[19px]" />
              {label}
            </NavLink>
          ))}
          {NAV_EXTRA.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${
                  isActive ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              <Icon className="h-[19px] w-[19px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 flex items-center justify-between px-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            Playlists
          </span>
          <Link to="/biblioteca?tab=playlists" className="icon-btn h-7 w-7" aria-label="Nova playlist">
            <Plus className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-1 flex-1 overflow-y-auto">
          {playlists.map((p) => (
            <NavLink
              key={p.id}
              to={`/playlist/${p.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-2 py-2 transition ${
                  isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`
              }
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md">
                <Cover cover={p.cover} color={p.color} kind="playlist" alt={p.name} rounded="rounded-md" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{p.name}</p>
                <p className="truncate text-[11px] text-ink-500">{p.items} itens</p>
              </div>
            </NavLink>
          ))}
          {!playlists.length && (
            <p className="px-3 py-2 text-[12px] leading-relaxed text-ink-500">
              Suas playlists aparecem aqui.
            </p>
          )}
        </div>

        <div className="mt-2 border-t border-white/[0.06] pt-2">
          {user?.role === 'admin' && (
            <NavLink
              to="/downloads"
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${
                  isActive ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              <Download className="h-[19px] w-[19px]" />
              Downloads
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink
              to="/ajustes?tab=upload"
              className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ink-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Upload className="h-[19px] w-[19px]" />
              Enviar arquivos
            </NavLink>
          )}
          <NavLink
            to="/ajustes"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ink-300 transition hover:bg-white/[0.04] hover:text-white"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
              style={{ background: user?.accent || '#7c5cff' }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </span>
            <span className="truncate">{user?.name}</span>
            <Settings className="ml-auto h-4 w-4" />
          </NavLink>
        </div>
      </aside>

      {/* ------------------------------- conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          id="main-scroll"
          className={`flex-1 overflow-y-auto px-4 pt-safe sm:px-6 md:px-8 ${
            current ? 'pb-[150px] md:pb-[110px]' : 'pb-[90px] md:pb-8'
          }`}
        >
          <Outlet />
        </main>
      </div>

      <PlayerBar />

      {/* ------------------------------- tabs (celular) */}
      {!expanded && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/95 pb-safe backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-5">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                    isActive ? 'text-white' : 'text-ink-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className="h-[21px] w-[21px]"
                      style={isActive ? { color: 'var(--accent)' } : undefined}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
            <NavLink
              to="/ajustes"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                  isActive ? 'text-white' : 'text-ink-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="grid h-[21px] w-[21px] place-items-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background: user?.accent || '#7c5cff',
                      outline: isActive ? '2px solid rgba(255,255,255,.5)' : undefined,
                      outlineOffset: '2px',
                    }}
                  >
                    {user?.name?.[0]?.toUpperCase()}
                  </span>
                  Perfil
                </>
              )}
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}

/** Botão flutuante de "adicionar" usado em algumas páginas. */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  const { current } = usePlayer();
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`fixed right-4 z-20 grid h-14 w-14 place-items-center rounded-full text-white shadow-2xl shadow-black/50 transition active:scale-90 md:hidden ${
        current ? 'bottom-[132px]' : 'bottom-[80px]'
      }`}
      style={{ background: 'var(--accent)' }}
    >
      <ListPlus className="h-6 w-6" />
    </button>
  );
}
