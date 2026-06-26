-- =====================================================================
-- Rollback — Migration 002 (Etiquetas e Checklists)
-- Desfaz as tabelas criadas em 002-tags-checklists.sql
-- =====================================================================

drop trigger if exists trg_checklist_items_updated_at on checklist_items;
drop table if exists checklist_items;
drop table if exists lead_tags;
drop table if exists tags;
