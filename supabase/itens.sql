-- ============================================================
-- O CATÁLOGO
--
-- A lista fechada do que se pode vender aqui. O dono da revenda
-- não cria item: ele marca quais destes vende e por quanto.
--
-- É o que faz o preço ser comparável. Com texto livre, "P13",
-- "botijão 13" e "gás 13 kg" virariam três produtos diferentes, e
-- o site deixaria de responder a única pergunta que o cliente
-- veio fazer.
--
-- Item novo entra por aqui, com um insert. É de propósito que
-- dependa de nós: cada item a mais é uma linha a mais no painel
-- de toda revenda.
-- ============================================================

insert into itens (tipo, nome, apelido, ordem) values
  -- GÁS ------------------------------------------------------
  -- O P13 é o botijão de cozinha, e responde pela quase
  -- totalidade dos pedidos. Vem primeiro porque é o que 9 em cada
  -- 10 visitantes vieram procurar.
  ('gas',  'Botijão P13 — 13 kg',        'P13',  10),
  ('gas',  'Botijão P45 — 45 kg',        'P45',  20),
  ('gas',  'Botijão P8 — 8 kg',          'P8',   30),
  ('gas',  'Botijão P5 — 5 kg',          'P5',   40),
  ('gas',  'Botijão P2 — 2 kg',          'P2',   50),

  -- ÁGUA -----------------------------------------------------
  -- "Galão de água", sempre inteiro: "galão" sozinho não diz do quê.
  ('agua', 'Galão de água 20 litros',    'Galão de água 20L', 10),
  ('agua', 'Galão de água 10 litros',    'Galão de água 10L', 20),
  ('agua', 'Galão de água 5 litros',     'Galão de água 5L',  30),
  ('agua', 'Fardo 1,5 litro — 6 unidades', 'Fardo 1,5L', 40),
  ('agua', 'Fardo 500 ml — 12 unidades',   'Fardo 500ml', 50)
on conflict (tipo, nome) do nothing;
