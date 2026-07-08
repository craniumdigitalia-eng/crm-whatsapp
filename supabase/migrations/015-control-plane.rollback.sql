-- Rollback de 015-control-plane.sql — remove o schema control_plane por completo.
-- Dropar na ordem inversa de dependencia (FK mais especifica primeiro).
-- Todas as instrucoes sao idempotentes (if exists).
--
-- ATENCAO: este rollback remove permanentemente todos os dados de tenants,
-- assinaturas, faturas e auditoria do control-plane. Confirme backup antes de executar.

drop table if exists control_plane.admin_actions;
drop table if exists control_plane.admins;
drop table if exists control_plane.webhook_events;
drop table if exists control_plane.invoices;
drop table if exists control_plane.subscription_events;
drop table if exists control_plane.subscriptions;
drop table if exists control_plane.plans;
drop table if exists control_plane.tenants;

drop schema if exists control_plane cascade;
