import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorBox, Loading } from '../components/ui';

export function Login() {
  const { user, loading, needsSetup, login, setup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading label="Carregando…" />;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (needsSetup) await setup(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden px-5 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(90% 60% at 50% 0%, #241a4d 0%, #08080b 70%)' }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center gap-4 text-center">
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl shadow-xl shadow-brand-500/20"
            style={{ background: 'linear-gradient(140deg,#7c5cff,#e84ab2)' }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white">
              <path d="M8 5.5 19 12 8 18.5z" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {needsSetup ? 'Bem-vindo ao Sonify' : 'Sonify'}
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              {needsSetup
                ? 'Crie a conta de administrador da sua biblioteca'
                : 'Sua música e seus vídeos, do seu jeito'}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {needsSetup && (
            <input
              className="field"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          )}
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={needsSetup ? 'new-password' : 'current-password'}
            required
          />

          {error && <ErrorBox message={error} />}

          <button className="btn-primary mt-2 w-full py-3" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {needsSetup ? 'Criar conta e entrar' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
