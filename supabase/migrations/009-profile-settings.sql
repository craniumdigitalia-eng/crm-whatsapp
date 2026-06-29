-- Migration 009 — Perfil: foto (avatar) + bucket de Storage (Story 5.2, tela /config)
--
-- Adiciona a coluna `avatar_url` em profiles e cria o bucket público `avatars`
-- no Supabase Storage, com policies que deixam cada usuário gerenciar APENAS a
-- própria pasta (`{user_id}/...`). A leitura é pública (a foto aparece na sidebar
-- e no portal sem precisar de sessão para servir a imagem).
--
-- Restrições do bucket:
--   - Tamanho máximo por arquivo: 2 MB (2097152 bytes). Bloqueia uploads abusivos.
--   - MIME types permitidos: image/jpeg, image/png, image/webp. Rejeita qualquer outro
--     formato (PDF, executável, SVG com scripts, etc.) diretamente no Storage.
--
-- Aplique no SQL Editor do Supabase. Idempotente (pode rodar de novo sem erro).

-- 1) Coluna da foto no perfil ---------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'URL pública da foto de perfil (bucket Storage `avatars`). Editável pelo próprio usuário em /config.';

-- 2) Bucket de avatares (público para leitura, com limites de tamanho e MIME) -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,                                              -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Policies de Storage --------------------------------------------------------
-- Leitura pública das imagens do bucket.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

-- Upload: só na própria pasta (primeiro segmento do path = uid do usuário).
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Update (upsert) da própria pasta.
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Delete da própria pasta (trocar/remover foto).
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
