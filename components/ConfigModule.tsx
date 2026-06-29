'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/* ============================================================
   Configurações de perfil (Story 5.2 — tela /config)
   Foto (avatar via Supabase Storage), nome de exibição e troca de senha.
   Reaproveita .integ-page / .integ-banner ; classes próprias em .cfg-*
   ============================================================ */

export interface ProfileData {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'atendente';
  avatarUrl: string | null;
}

const ROLE_LABELS: Record<ProfileData['role'], string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
};

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3 MB

export default function ConfigModule({
  initialProfile,
}: {
  initialProfile: ProfileData;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [nome, setNome] = useState(initialProfile.nome);
  const [savingNome, setSavingNome] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function flash(kind: 'ok' | 'err', text: string) {
    setMsg({ kind, text });
    if (kind === 'ok') setTimeout(() => setMsg(null), 4000);
  }

  const initial = (profile.nome.trim()[0] ?? profile.email[0] ?? 'U').toUpperCase();
  const nomeChanged = nome.trim() !== profile.nome && nome.trim().length > 0;

  async function patchProfile(patch: {
    nome?: string;
    avatar_url?: string | null;
  }): Promise<ProfileData> {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('não autenticado');
    }
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(b.error ?? res.statusText);
    }
    const { profile: p } = (await res.json()) as { profile: Record<string, unknown> };
    return {
      id: p.id as string,
      email: p.email as string,
      nome: (p.nome as string) ?? '',
      role: (p.role as ProfileData['role']) ?? 'atendente',
      avatarUrl: (p.avatar_url as string | null) ?? null,
    };
  }

  async function saveNome() {
    const v = nome.trim();
    if (!v) {
      flash('err', 'Informe um nome.');
      return;
    }
    setSavingNome(true);
    try {
      const p = await patchProfile({ nome: v });
      setProfile(p);
      setNome(p.nome);
      flash('ok', 'Nome atualizado.');
      router.refresh(); // atualiza a sidebar (server component)
    } catch (e) {
      flash('err', `Falha ao salvar o nome: ${(e as Error).message}`);
    } finally {
      setSavingNome(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flash('err', 'Selecione um arquivo de imagem.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      flash('err', 'Imagem muito grande (máximo 3 MB).');
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${profile.id}/avatar-${Date.now()}.${ext || 'jpg'}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const p = await patchProfile({ avatar_url: pub.publicUrl });
      setProfile(p);
      flash('ok', 'Foto atualizada.');
      router.refresh();
    } catch (e) {
      flash('err', `Falha ao enviar a foto: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    if (!profile.avatarUrl) return;
    setUploading(true);
    try {
      const p = await patchProfile({ avatar_url: null });
      setProfile(p);
      flash('ok', 'Foto removida.');
      router.refresh();
    } catch (e) {
      flash('err', `Falha ao remover a foto: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) {
      flash('err', 'A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (pwd !== pwd2) {
      flash('err', 'As senhas não conferem.');
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      setPwd('');
      setPwd2('');
      flash('ok', 'Senha alterada com sucesso.');
    } catch (e) {
      flash('err', `Falha ao alterar a senha: ${(e as Error).message}`);
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <section className="integ-page cfg-page">
      <header className="integ-head">
        <h1 className="integ-title">Configurações</h1>
        <p className="integ-subtitle">
          Gerencie seu <strong>perfil</strong>: foto, nome de exibição e senha de acesso ao portal.
        </p>
      </header>

      {msg && (
        <div
          className={`integ-banner ${msg.kind === 'ok' ? 'integ-banner--ok' : 'integ-banner--err'}`}
          role="status"
          aria-live="polite"
        >
          {msg.text}
        </div>
      )}

      <div className="cfg-grid">
        {/* ---------- Foto + identidade ---------- */}
        <section className="cfg-card" aria-labelledby="cfg-foto-h">
          <h2 className="cfg-card-title" id="cfg-foto-h">Foto de perfil</h2>
          <p className="cfg-card-hint">Aparece na barra lateral e ao lado das suas ações no portal.</p>

          <div className="cfg-avatar-row">
            <div className="cfg-avatar" aria-hidden={profile.avatarUrl ? undefined : true}>
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={`Foto de ${profile.nome || profile.email}`} />
              ) : (
                <span className="cfg-avatar-initial">{initial}</span>
              )}
            </div>

            <div className="cfg-avatar-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="cfg-file-input"
                onChange={onPickAvatar}
                disabled={uploading}
                aria-label="Escolher nova foto"
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Enviando…' : profile.avatarUrl ? 'Trocar foto' : 'Enviar foto'}
              </button>
              {profile.avatarUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={removeAvatar}
                  disabled={uploading}
                >
                  Remover
                </button>
              )}
              <p className="cfg-file-hint">JPG, PNG ou WEBP · até 3 MB</p>
            </div>
          </div>
        </section>

        {/* ---------- Dados da conta ---------- */}
        <section className="cfg-card" aria-labelledby="cfg-conta-h">
          <h2 className="cfg-card-title" id="cfg-conta-h">Dados da conta</h2>

          <label className="cfg-field">
            <span>Nome de exibição</span>
            <input
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
            />
          </label>

          <label className="cfg-field">
            <span>E-mail</span>
            <input value={profile.email} readOnly disabled aria-describedby="cfg-email-note" />
            <small id="cfg-email-note" className="cfg-field-note">
              O e-mail de acesso não pode ser alterado por aqui.
            </small>
          </label>

          <div className="cfg-field">
            <span>Papel</span>
            <div className="cfg-role-pill" data-role={profile.role}>
              {ROLE_LABELS[profile.role]}
            </div>
          </div>

          <div className="cfg-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveNome}
              disabled={savingNome || !nomeChanged}
            >
              {savingNome ? 'Salvando…' : 'Salvar nome'}
            </button>
          </div>
        </section>

        {/* ---------- Senha ---------- */}
        <section className="cfg-card" aria-labelledby="cfg-senha-h">
          <h2 className="cfg-card-title" id="cfg-senha-h">Alterar senha</h2>
          <p className="cfg-card-hint">Use ao menos 8 caracteres. Você seguirá logado após trocar.</p>

          <form onSubmit={changePassword}>
            <label className="cfg-field">
              <span>Nova senha</span>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </label>
            <label className="cfg-field">
              <span>Confirmar nova senha</span>
              <input
                type="password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </label>
            <div className="cfg-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingPwd || !pwd || !pwd2}
              >
                {savingPwd ? 'Alterando…' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
