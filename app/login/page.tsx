'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import BrandBackgroundVideo from '@/components/BrandBackgroundVideo';

/* ============================================================
   Login (Story 5.2)
   Portal interno da Cranium — autenticacao via Supabase (email/senha).
   Tela branded, com estados de erro/loading e acessibilidade.
   ============================================================ */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }

    // Sessao gravada nos cookies — segue para o portal.
    router.push('/');
    router.refresh();
  }

  return (
    <main className="login-screen">
      <BrandBackgroundVideo />

      {/* Cerebro da marca em destaque: glow roxo pulsante + float suave */}
      <div className="login-hero">
        <div className="login-hero__brain" role="img" aria-label="Cranium Digital">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/cranium-brain.png" alt="" aria-hidden="true" />
        </div>
        <div className="brand-wordmark login-hero__wordmark">
          <span className="brand-wordmark__name">Cranium</span>
          <span className="brand-wordmark__suffix">digital</span>
        </div>
      </div>

      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title" className="login-title">Entrar no portal</h1>
        <p className="login-subtitle">Acesso restrito à equipe da Cranium.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              disabled={loading}
              placeholder="voce@craniumdigital.com"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              disabled={loading}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="login-error" role="alert">{error}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading || !email || !password}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="login-subtitle login-forgot">
          <Link href="/reset-password">Esqueci minha senha</Link>
        </p>
      </section>
    </main>
  );
}
