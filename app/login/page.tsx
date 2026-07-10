'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import BrandBackgroundVideo from '@/components/BrandBackgroundVideo';

/* ============================================================
   Login (Story 5.2) — visual alinhado ao portal.craniumdigital.com.br
   Card glass escuro sobre o video cinematografico, cerebro em destaque,
   inputs com icone, olho de senha. Mesma identidade do portal do corretor.
   ============================================================ */

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    router.push('/');
    router.refresh();
  }

  return (
    <main className="login-screen">
      <BrandBackgroundVideo />

      <section className="login-card login-card--glass" aria-labelledby="login-title">
        <div className="login-brain-box" role="img" aria-label="Cranium Digital">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/cranium-brain.png" alt="" aria-hidden="true" />
        </div>

        <p className="login-eyebrow">CRANIUM</p>
        <h1 id="login-title" className="login-title login-title--xl">Entrar</h1>
        <p className="login-subtitle">Inteligência de quem vive o mercado.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email">E-mail</label>
            <div className="login-input">
              <span className="login-input__icon"><MailIcon /></span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                disabled={loading}
                placeholder="email@corretor.com"
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password">Senha</label>
            <div className="login-input">
              <span className="login-input__icon"><LockIcon /></span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                disabled={loading}
                placeholder="••••••••"
                className="has-eye"
              />
              <button
                type="button"
                className="login-input__eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <Link href="/reset-password" className="login-forgot-link">Esqueci a senha</Link>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading || !email || !password}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
