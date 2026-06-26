-- =====================================================================
-- Rollback — Migration 003 (Atribuição de leads / Meta Lead Ads)
-- Desfaz colunas, índices e tabela criados em 003-lead-attribution.sql
-- =====================================================================

drop index if exists idx_leads_leadgen_id;
drop index if exists idx_leads_source;

alter table leads drop column if exists source;
alter table leads drop column if exists form_id;
alter table leads drop column if exists leadgen_id;
alter table leads drop column if exists ad_id;
alter table leads drop column if exists campaign_id;
alter table leads drop column if exists form_data;

drop trigger if exists trg_integrations_config_updated_at on integrations_config;
drop table if exists integrations_config;
