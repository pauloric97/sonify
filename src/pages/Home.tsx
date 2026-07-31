import { Link } from 'react-router-dom';
import { Library, Upload } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { usePlayer } from '../lib/player';
import { MediaTile } from '../components/Cards';
import { Empty, ErrorBox, Loading, Row, SectionTitle } from '../components/ui';
import type { HomeData, Media } from '../types';

const saudacao = () => {
  const h = new Date().getHours();
  if (h < 6) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

export function Home() {
  const { user } = useAuth();
  const { play } = usePlayer();
  const { data, loading, error } = useApi<HomeData>('/library/home');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const empty = data.counts.tracks === 0 && data.counts.videos === 0;

  const section = (title: string, items: Media[], link?: string) =>
    items.length > 0 && (
      <section className="mb-8">
        <SectionTitle
          action={
            link ? (
              <Link to={link} className="text-[13px] font-medium text-ink-400 hover:text-white">
                ver tudo
              </Link>
            ) : undefined
          }
        >
          {title}
        </SectionTitle>
        <Row>
          {items.map((m) => (
            <MediaTile key={`${title}-${m.id}`} media={m} onPlay={() => play(items, items.indexOf(m))} />
          ))}
        </Row>
      </section>
    );

  return (
    <div className="mx-auto max-w-[1400px] py-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-[34px]">
          {saudacao()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          {data.counts.tracks} faixas • {data.counts.videos} vídeos
        </p>
      </header>

      {empty ? (
        <Empty
          icon={<Library className="h-10 w-10" />}
          title="Sua biblioteca está vazia"
          hint={
            user?.role === 'admin'
              ? 'Envie seus arquivos ou importe o que já está no bucket. Os dois ficam em Ajustes.'
              : 'Peça pro admin subir os arquivos.'
          }
          action={
            user?.role === 'admin' ? (
              <Link to="/ajustes?tab=upload" className="btn-primary mt-2">
                <Upload className="h-4 w-4" />
                Adicionar mídia
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {section('Continuar de onde parou', data.continue)}
          {section('Tocadas recentemente', data.recent)}
          {section('Adicionado recentemente', data.added, '/biblioteca')}
          {section('Mais tocadas', data.top)}
        </>
      )}
    </div>
  );
}
