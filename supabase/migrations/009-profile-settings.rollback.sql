-- Rollback da Migration 009 — remove avatar + policies + bucket.
-- ATENÇÃO: dropar o bucket remove as imagens já enviadas.

drop policy if exists "avatars_public_read"  on storage.objects;
drop policy if exists "avatars_insert_own"   on storage.objects;
drop policy if exists "avatars_update_own"   on storage.objects;
drop policy if exists "avatars_delete_own"   on storage.objects;

-- Esvazia e remove o bucket (descomente se quiser apagar de vez).
-- delete from storage.objects where bucket_id = 'avatars';
-- delete from storage.buckets where id = 'avatars';

alter table public.profiles drop column if exists avatar_url;
