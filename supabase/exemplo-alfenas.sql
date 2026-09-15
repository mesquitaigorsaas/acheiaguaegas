-- ============================================================
-- REVENDAS DE EXEMPLO — Alfenas
--
-- Seis revendas de mentira, para o site ter o que mostrar
-- antes de existir cliente de verdade. É o mesmo papel do Dom
-- Sanduíche no Cardápio Online: dá para demonstrar o produto a
-- alguém sem depender de ter vendido antes.
--
-- São diferentes de propósito, e cada diferença testa uma
-- regra: raios de 5 a 15 km, uma que só atende no balcão,
-- uma que só entrega, uma aberta dia e noite, uma em Machado
-- a 27 km — que só aparece para quem vai buscar.
--
-- PARA APAGAR TODAS, quando os clientes de verdade chegarem:
--   delete from revendas where cnpj like '99%';
--
-- O CNPJ começa com 99 justamente para isso: separa o que é
-- exemplo do que é cliente, sem depender de lembrar os nomes.
-- ============================================================

-- Gás Central Alfenas
do $$
declare v_id uuid;
begin
  insert into revendas (nome, cnpj, whatsapp, telefone_responsavel, endereco_texto,
                        latitude, longitude, faz_entrega, faz_retirada,
                        raio_entrega_km, publicado, assinatura_status)
  values ('Gás Central Alfenas', '99000000000001', '35999990001', '',
          'Av. Governador Valadares, Centro', -21.4258, -45.9472,
          true, true, 8, true, 'ativa')
  on conflict (cnpj) do nothing
  returning id into v_id;

  if v_id is null then return; end if;

  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Segunda a sábado', array[1,2,3,4,5,6]::smallint[], '07:00', '19:00', 10);
  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Domingo', array[0]::smallint[], '08:00', '12:00', 20);

  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 105.00 from itens where tipo = 'gas' and apelido = 'P13';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 420.00 from itens where tipo = 'gas' and apelido = 'P45';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 89.00 from itens where tipo = 'gas' and apelido = 'P8';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 14.00 from itens where tipo = 'agua' and apelido = 'Galão de água 20L';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 9.00 from itens where tipo = 'agua' and apelido = 'Galão de água 10L';
end $$;

-- Água e Gás do Zé
do $$
declare v_id uuid;
begin
  insert into revendas (nome, cnpj, whatsapp, telefone_responsavel, endereco_texto,
                        latitude, longitude, faz_entrega, faz_retirada,
                        raio_entrega_km, publicado, assinatura_status)
  values ('Água e Gás do Zé', '99000000000002', '35999990002', '',
          'R. Pedro Ferreira, Jardim Alvorada', -21.4192, -45.9531,
          true, true, 5, true, 'ativa')
  on conflict (cnpj) do nothing
  returning id into v_id;

  if v_id is null then return; end if;

  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Todos os dias', array[0,1,2,3,4,5,6]::smallint[], '06:30', '22:00', 10);

  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 99.90 from itens where tipo = 'gas' and apelido = 'P13';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 85.00 from itens where tipo = 'gas' and apelido = 'P8';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 12.50 from itens where tipo = 'agua' and apelido = 'Galão de água 20L';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 8.50 from itens where tipo = 'agua' and apelido = 'Galão de água 10L';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 21.90 from itens where tipo = 'agua' and apelido = 'Fardo 1,5L';
end $$;

-- Supergasbras Vila Teixeira
do $$
declare v_id uuid;
begin
  insert into revendas (nome, cnpj, whatsapp, telefone_responsavel, endereco_texto,
                        latitude, longitude, faz_entrega, faz_retirada,
                        raio_entrega_km, publicado, assinatura_status)
  values ('Supergasbras Vila Teixeira', '99000000000003', '35999990003', '',
          'R. Geraldo Freitas da Costa, Vila Teixeira', -21.4341, -45.9398,
          false, true, 12, true, 'ativa')
  on conflict (cnpj) do nothing
  returning id into v_id;

  if v_id is null then return; end if;

  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Segunda a sexta', array[1,2,3,4,5]::smallint[], '08:00', '18:00', 10);
  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Sábado', array[6]::smallint[], '08:00', '13:00', 20);

  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 102.00 from itens where tipo = 'gas' and apelido = 'P13';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 405.00 from itens where tipo = 'gas' and apelido = 'P45';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 62.00 from itens where tipo = 'gas' and apelido = 'P5';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 13.00 from itens where tipo = 'agua' and apelido = 'Galão de água 20L';
end $$;

-- Disk Gás 24 Horas
do $$
declare v_id uuid;
begin
  insert into revendas (nome, cnpj, whatsapp, telefone_responsavel, endereco_texto,
                        latitude, longitude, faz_entrega, faz_retirada,
                        raio_entrega_km, publicado, assinatura_status)
  values ('Disk Gás 24 Horas', '99000000000004', '35999990004', '',
          'Av. Dr. Luiz Ribeiro, Santa Clara', -21.4415, -45.9605,
          true, false, 15, true, 'ativa')
  on conflict (cnpj) do nothing
  returning id into v_id;

  if v_id is null then return; end if;

  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Todos os dias, dia e noite', array[0,1,2,3,4,5,6]::smallint[], '00:00', '00:00', 10);

  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 112.00 from itens where tipo = 'gas' and apelido = 'P13';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 95.00 from itens where tipo = 'gas' and apelido = 'P8';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 16.00 from itens where tipo = 'agua' and apelido = 'Galão de água 20L';
end $$;

-- Água Pura Distribuidora
do $$
declare v_id uuid;
begin
  insert into revendas (nome, cnpj, whatsapp, telefone_responsavel, endereco_texto,
                        latitude, longitude, faz_entrega, faz_retirada,
                        raio_entrega_km, publicado, assinatura_status)
  values ('Água Pura Distribuidora', '99000000000005', '35999990005', '',
          'R. Silvestre Ferraz, Centro', -21.4277, -45.9451,
          true, true, 6, true, 'ativa')
  on conflict (cnpj) do nothing
  returning id into v_id;

  if v_id is null then return; end if;

  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Segunda a sábado', array[1,2,3,4,5,6]::smallint[], '07:30', '18:30', 10);

  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 11.90 from itens where tipo = 'agua' and apelido = 'Galão de água 20L';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 8.00 from itens where tipo = 'agua' and apelido = 'Galão de água 10L';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 19.90 from itens where tipo = 'agua' and apelido = 'Fardo 1,5L';
end $$;

-- Gás Bom Preço Machado
do $$
declare v_id uuid;
begin
  insert into revendas (nome, cnpj, whatsapp, telefone_responsavel, endereco_texto,
                        latitude, longitude, faz_entrega, faz_retirada,
                        raio_entrega_km, publicado, assinatura_status)
  values ('Gás Bom Preço Machado', '99000000000006', '35999990006', '',
          'Centro, Machado', -21.6742, -45.9195,
          true, true, 10, true, 'ativa')
  on conflict (cnpj) do nothing
  returning id into v_id;

  if v_id is null then return; end if;

  insert into horarios (revenda_id, rotulo, dias_semana, abre, fecha, ordem)
  values (v_id, 'Segunda a sábado', array[1,2,3,4,5,6]::smallint[], '07:00', '18:00', 10);

  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 92.00 from itens where tipo = 'gas' and apelido = 'P13';
  insert into precos (revenda_id, item_id, preco)
  select v_id, id, 10.90 from itens where tipo = 'agua' and apelido = 'Galão de água 20L';
end $$;

