-- Rollback de 011-finance.sql — remove o módulo Financeiro.
drop table if exists public.fin_revenue;
drop table if exists public.fin_expenses;
drop table if exists public.fin_clients;
