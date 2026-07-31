import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { plural } from '../lib/format';
import { DetailHeader } from '../components/DetailHeader';
import { TrackList } from '../components/TrackList';
import { ErrorBox, Loading } from '../components/ui';
import type { Media, SeriesSummary } from '../types';

interface Data {
  series: SeriesSummary;
  episodes: Media[];
}

export function SeriesPage() {
  const [params] = useSearchParams();
  const name = params.get('name') || '';
  const navigate = useNavigate();

  const { data, loading, error, reload } = useApi<Data>(
    `/library/series?name=${encodeURIComponent(name)}`,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  // Continua de onde parou; se já viu tudo, começa do primeiro.
  const proximo = data.episodes.find((e) => !e.completed) || data.episodes[0];

  return (
    <div className="mx-auto max-w-[1400px] pb-6">
      <DetailHeader
        title={data.series.name}
        cover={data.series.cover}
        color={data.series.color}
        kind="video"
        meta={plural(data.episodes.length, 'episódio', 'episódios')}
        onPlay={() => navigate(`/assistir/${proximo.id}`)}
      />

      <TrackList tracks={data.episodes} showCover onChanged={reload} />
    </div>
  );
}
