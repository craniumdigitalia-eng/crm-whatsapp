'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import BrandBackgroundVideo from '@/components/BrandBackgroundVideo';

/* ============================================================
   Recuperacao de senha (Story 5.2 / feedback do usuario)
   Uma pagina, dois modos:
   - "pedir": sem sessao de recuperacao -> digita o e-mail e recebe o link.
   - "trocar": chegou pelo link do e-mail (codigo/sessao de recuperacao) -> define a nova senha.
   Rota publica (liberada no middleware) pois o usuario chega aqui deslogado.
   ============================================================ */
export default function ResetPasswordPage() {
  const router = useRouter();

  // null enquanto decide o modo; 'pedir' ou 'trocar' depois de checar a URL.
  const [modo, setModo] = useState<'pedir' | 'trocar' | null>(null);
  const [linkErro, setLinkErro] = useState<string | null>(null);

  // Campos
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [trocado, setTrocado] = useState(false);

  // Ao montar: se o link trouxe um codigo/erro, entra no modo "trocar".
  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      const code = url.searchParams.get('code');
      const errDesc =
        url.searchParams.get('error_description') || hashParams.get('error_description');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (errDesc) {
        setLinkErro('O link de recuperação é inválido ou expirou. Peça um novo abaixo.');
        setModo('pedir');
        return;
      }

      // Fluxo implicito (padrao do e-mail de recuperacao): tokens vem no hash da URL.
      // Trata explicitamente com setSession para nao depender do auto-detect.
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setLinkErro('O link de recuperação é inválido ou expirou. Peça um novo abaixo.');
          setModo('pedir');
          return;
        }
        // Limpa os tokens da barra de endereco.
        window.history.replaceState(null, '', url.pathname);
        setModo('trocar');
        return;
      }

      // Fluxo PKCE: troca o codigo por uma sessao de recuperacao.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setLinkErro('O link de recuperação é inválido ou expirou. Peça um novo abaixo.');
          setModo('pedir');
          return;
        }
        window.history.replaceState(null, '', url.pathname);
        setModo('trocar');
        return;
      }

      // Sem token/codigo na URL: talvez ja exista sessao; senao, pedir o link.
      const { data } = await supabase.auth.getSession();
      setModo(data.session ? 'trocar' : 'pedir');
    }

    init();
  }, []);

  // Modo "pedir": envia o e-mail com o link de recuperacao.
  async function handlePedir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // Nao revelar se o e-mail existe: sempre confirma o envio.
    if (resetErr) {
      // Erros reais (rate limit etc.) ainda merecem aviso discreto.
      setError('Não foi possível enviar agora. Tente de novo em alguns minutos.');
      setLoading(false);
      return;
    }

    setEnviado(true);
    setLoading(false);
  }

  // Modo "trocar": define a nova senha na sessao de recuperacao.
  async function handleTrocar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password });

    if (updErr) {
      setError('Não foi possível atualizar a senha. Peça um novo link e tente de novo.');
      setLoading(false);
      return;
    }

    setTrocado(true);
    setLoading(false);
    // Encerra a sessao de recuperacao e leva pro login.
    await supabase.auth.signOut();
    setTimeout(() => {
      router.push('/login');
      router.refresh();
    }, 1600);
  }

  return (
    <main className="login-screen">
      <BrandBackgroundVideo />

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

      <section className="login-card" aria-labelledby="reset-title">
        {modo === null && (
          <p className="login-subtitle" role="status">Carregando…</p>
        )}

        {/* ---------- Modo: pedir link ---------- */}
        {modo === 'pedir' && !enviado && (
          <>
            <h1 id="reset-title" className="login-title">Recuperar senha</h1>
            <p className="login-subtitle">
              Digite seu e-mail e enviamos um link para você criar uma nova senha.
            </p>

            {linkErro && <p className="login-error" role="alert">{linkErro}</p>}

            <form className="login-form" onSubmit={handlePedir} noValidate>
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
                  disabled={loading}
                  placeholder="voce@craniumdigital.com"
                />
              </div>

              {error && <p className="login-error" role="alert">{error}</p>}

              <button
                type="submit"
                className="btn btn-primary login-submit"
                disabled={loading || !email}
              >
                {loading ? 'Enviando…' : 'Enviar link de recuperação'}
              </button>
            </form>

            <p className="login-subtitle" style={{ marginTop: '1rem' }}>
              <Link href="/login">Voltar para o login</Link>
            </p>
          </>
        )}

        {/* ---------- Modo: pedir link -> enviado ---------- */}
        {modo === 'pedir' && enviado && (
          <>
            <h1 id="reset-title" className="login-title">Verifique seu e-mail</h1>
            <p className="login-subtitle">
              Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.
              O link vale por 1 hora. Confira também a caixa de spam.
            </p>
            <p className="login-subtitle" style={{ marginTop: '1rem' }}>
              <Link href="/login">Voltar para o login</Link>
            </p>
          </>
        )}

        {/* ---------- Modo: trocar senha ---------- */}
        {modo === 'trocar' && !trocado && (
          <>
            <h1 id="reset-title" className="login-title">Criar nova senha</h1>
            <p className="login-subtitle">Escolha uma senha nova para sua conta.</p>

            <form className="login-form" onSubmit={handleTrocar} noValidate>
              <div className="login-field">
                <label htmlFor="password">Nova senha</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="ao menos 8 caracteres"
                />
              </div>

              <div className="login-field">
                <label htmlFor="confirm">Confirmar senha</label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                  placeholder="repita a nova senha"
                />
              </div>

              {error && <p className="login-error" role="alert">{error}</p>}

              <button
                type="submit"
                className="btn btn-primary login-submit"
                disabled={loading || !password || !confirm}
              >
                {loading ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}

        {/* ---------- Modo: trocar senha -> ok ---------- */}
        {modo === 'trocar' && trocado && (
          <>
            <h1 id="reset-title" className="login-title">Senha atualizada</h1>
            <p className="login-subtitle" role="status">
              Pronto! Redirecionando para o login…
            </p>
          </>
        )}
      </section>
    </main>
  );
}
