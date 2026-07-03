-- Rollback da Migration 010 — remove a coluna de foto do lead.
alter table public.leads drop column if exists photo_url;
