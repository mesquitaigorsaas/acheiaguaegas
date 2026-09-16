-- ============================================================
-- 008-p20-p90.sql
--
-- Dois botijões que a tabela das distribuidoras tem e o catálogo
-- não tinha: o P20, de empilhadeira, e o P90, industrial. As fotos
-- dos dois já estão em assets/botijoes.
--
-- E o catálogo inteiro passa para a ordem numérica, do menor para
-- o maior — P2, P5, P8, P13, P20, P45, P90, e na água 500 ml,
-- 1,5 L, 5 L, 10 L, 20 L. É a ordem da tela do cliente, e o painel
-- da revenda, que lê esta coluna, passa a listar igual.
--
-- Pode rodar a qualquer momento, e mais de uma vez.
-- ============================================================

begin;

insert into itens (tipo, nome, apelido, ordem) values
  ('gas', 'Botijão P20 — 20 kg', 'P20', 50),
  ('gas', 'Botijão P90 — 90 kg', 'P90', 70)
on conflict (tipo, nome) do nothing;

update itens set ordem = case apelido
    when 'P2'  then 10
    when 'P5'  then 20
    when 'P8'  then 30
    when 'P13' then 40
    when 'P20' then 50
    when 'P45' then 60
    when 'P90' then 70
  end
 where tipo = 'gas'
   and apelido in ('P2', 'P5', 'P8', 'P13', 'P20', 'P45', 'P90');

update itens set ordem = case apelido
    when 'Fardo 500ml'       then 10
    when 'Fardo 1,5L'        then 20
    when 'Galão de água 5L'  then 30
    when 'Galão de água 10L' then 40
    when 'Galão de água 20L' then 50
  end
 where tipo = 'agua'
   and apelido in ('Fardo 500ml', 'Fardo 1,5L', 'Galão de água 5L', 'Galão de água 10L', 'Galão de água 20L');

commit;
