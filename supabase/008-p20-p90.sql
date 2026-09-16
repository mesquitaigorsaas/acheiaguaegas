-- ============================================================
-- 008-p20-p90.sql
--
-- Dois botijões que a tabela das distribuidoras tem e o catálogo
-- não tinha: o P20, de empilhadeira, e o P90, industrial. Os
-- desenhos dos dois já estão no js/desenhos.js.
--
-- Entram depois do P45 e antes dos pequenos: são de comércio e
-- indústria, e quem procura o de cozinha não precisa passar por
-- eles primeiro.
--
-- Pode rodar a qualquer momento. Rodar duas vezes não duplica.
-- ============================================================

insert into itens (tipo, nome, apelido, ordem) values
  ('gas', 'Botijão P20 — 20 kg', 'P20', 22),
  ('gas', 'Botijão P90 — 90 kg', 'P90', 24)
on conflict (tipo, nome) do nothing;
