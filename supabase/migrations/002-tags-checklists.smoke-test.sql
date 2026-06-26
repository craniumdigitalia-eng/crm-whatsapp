-- =====================================================================
-- Smoke test — Migration 002 (Etiquetas e Checklists)
-- Rode no SQL Editor do Supabase após aplicar a migration 002.
-- Ao final, faz rollback do próprio teste (dados limpos).
-- =====================================================================

begin;

-- 1. Cria uma etiqueta
insert into tags (id, name, color)
values ('00000000-0000-0000-0000-000000000101', 'Urgente', '#EF4444');

-- 2. Cria um lead de teste
insert into leads (id, phone, name)
values ('00000000-0000-0000-0000-000000000001', '+5511999990001', 'Lead Smoke Test');

-- 3. Atribui a etiqueta ao lead
insert into lead_tags (lead_id, tag_id)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101');

-- 4. Cria um item de checklist
insert into checklist_items (lead_id, text, position)
values ('00000000-0000-0000-0000-000000000001', 'Enviar proposta', 0);

-- 5. Lista as etiquetas do lead (deve retornar 1 linha)
select l.name as lead, t.name as tag, t.color
from lead_tags lt
join leads l on l.id = lt.lead_id
join tags  t on t.id = lt.tag_id
where lt.lead_id = '00000000-0000-0000-0000-000000000001';

-- 6. Lista os itens do checklist (deve retornar 1 linha com done=false)
select id, text, done, position, created_at, updated_at
from checklist_items
where lead_id = '00000000-0000-0000-0000-000000000001'
order by position;

-- 7. Marca o item como feito (testa trigger updated_at)
update checklist_items
set done = true
where lead_id = '00000000-0000-0000-0000-000000000001';

-- 8. Verifica updated_at atualizado (deve ser > created_at)
select id, done, created_at, updated_at,
       (updated_at > created_at) as trigger_ok
from checklist_items
where lead_id = '00000000-0000-0000-0000-000000000001';

-- 9. Limpa os dados de teste (rollback do smoke test)
rollback;
