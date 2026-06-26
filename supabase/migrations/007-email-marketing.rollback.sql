-- =====================================================================
-- Rollback — Migration 007 (Email Marketing)
-- Desfaz as tabelas/colunas criadas em 007-email-marketing.sql.
-- =====================================================================

drop table if exists email_events;
drop table if exists email_unsubscribes;
drop table if exists email_campaigns;

drop trigger if exists trg_email_templates_updated_at on email_templates;
drop table if exists email_templates;

drop table if exists email_contacts;
drop table if exists email_lists;

-- A coluna leads.email é removida por último (templates/campanhas não dependem dela).
drop index if exists idx_leads_email;
alter table leads drop column if exists email;
