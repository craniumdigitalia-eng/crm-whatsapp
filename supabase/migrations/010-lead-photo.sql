-- Migration 010 — Foto do lead (foto de perfil do WhatsApp)
--
-- Adiciona a coluna `photo_url` em leads, preenchida com a URL da foto de perfil
-- do contato no WhatsApp (buscada via Evolution fetchProfilePictureUrl). A foto
-- aparece no avatar das Conversas, do kanban e da ficha do lead.
--
-- Aplique no SQL Editor do Supabase. Idempotente.

alter table public.leads
  add column if not exists photo_url text;

comment on column public.leads.photo_url is
  'URL da foto de perfil do WhatsApp do lead (Evolution fetchProfilePictureUrl). Pode ser nula.';
