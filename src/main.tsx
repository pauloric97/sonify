import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { PlayerProvider } from './lib/player';
import { AppShell } from './components/AppShell';
import { Loading } from './components/ui';

import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { SearchPage } from './pages/Search';
import { LibraryPage } from './pages/Library';
import { AlbumPage } from './pages/Album';
import { ArtistPage } from './pages/Artist';
import { VideosPage } from './pages/Videos';
import { SeriesPage } from './pages/Series';
import { WatchPage } from './pages/Watch';
import { PlaylistPage } from './pages/PlaylistPage';
import { FavoritesPage } from './pages/Favorites';
import { SettingsPage } from './pages/Settings';
import { DownloadsPage } from './pages/Downloads';
import { ExplorarPage } from './pages/Explorar';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Abrindo sua biblioteca…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/assistir/:id" element={<WatchPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="/buscar" element={<SearchPage />} />
          <Route path="/biblioteca" element={<LibraryPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/favoritos" element={<FavoritesPage />} />
          <Route path="/album" element={<AlbumPage />} />
          <Route path="/artista" element={<ArtistPage />} />
          <Route path="/serie" element={<SeriesPage />} />
          <Route path="/playlist/:id" element={<PlaylistPage />} />
          <Route path="/explorar" element={<ExplorarPage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
