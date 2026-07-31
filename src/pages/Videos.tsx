import { Clapperboard } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { MediaTile, SeriesTile } from '../components/Cards';
import { Empty, ErrorBox, Loading, Row, SectionTitle } from '../components/ui';
import type { Media, SeriesSummary } from '../types';

interface Data {
  series: SeriesSummary[];
  movies: Media[];
}

export function VideosPage() {
  const { data, loading, error } = useApi<Data>('/library/videos');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const continuar = data.movies.filter((m) => (m.position || 0) > 30 && !m.completed);

  return (
    <div className="mx-auto max-w-[1400px] py-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Vídeos</h1>

      {!data.series.length && !data.movies.length && (
        <Empty
          icon={<Clapperboard className="h-10 w-10" />}
          title="Nenhum vídeo ainda"
          hint="Suba um mp4 em Ajustes ou importe o que já está no bucket."
        />
      )}

      {continuar.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Continuar assistindo</SectionTitle>
          <Row>
            {continuar.map((m) => (
              <MediaTile key={m.id} media={m} />
            ))}
          </Row>
        </section>
      )}

      {data.series.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Séries</SectionTitle>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.series.map((s) => (
              <SeriesTile key={s.name} series={s} />
            ))}
          </div>
        </section>
      )}

      {data.movies.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Filmes e avulsos</SectionTitle>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.movies.map((m) => (
              <MediaTile key={m.id} media={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
