-- =====================================================================
-- Rollback — Migration 008 (Follow-up agendado por lead)
-- Desfaz a tabela criada em 008-followup-schedule.sql.
-- Os indices caem junto com a tabela (DROP TABLE remove os indices dependentes).
-- =====================================================================

drop table if exists follow_up_schedule;
