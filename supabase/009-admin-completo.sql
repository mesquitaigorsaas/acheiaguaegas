-- ============================================================
-- 009-admin-completo.sql — o administrador manda em tudo
--
-- Rode DEPOIS do 007.
--
-- O 006 dava ao administrador uma porta só: ativar quem pagou.
-- Aqui ele ganha o resto, tudo pela mesma tela do celular:
--
--   admin_revendas()                 — todas, de qualquer situação
--   admin_detalhe(id)                — preços, horários e o dono
--   admin_editar_revenda(id, dados)  — muda os dados cadastrais
--   admin_mudar_situacao(id, status) — bloqueia, cancela, volta a
--                                      aguardar pagamento
--   admin_apagar_revenda(id)         — apaga a revenda e o acesso
--
-- Liberar continua sendo o ativar_revenda(), do 006: é ele que
-- conta o vencimento a partir do plano.
--
-- Mesma regra do 006: a tabela `revendas` continua fechada para o
-- navegador. Cada função confere, na primeira linha, se quem
-- chamou é administrador, e roda com direitos próprios.
-- ============================================================


-- ------------------------------------------------------------
-- A lista inteira
--
-- Quem espera pagamento vem primeiro: é onde existe dinheiro
-- parado. Depois as suspensas, as ativas e as canceladas, e
-- dentro de cada grupo por nome.
--
-- O e-mail do dono vem de auth.users, que o navegador não lê: é
-- o contato que sobra quando o WhatsApp não responde.
-- ------------------------------------------------------------
create or replace function admin_revendas()
returns table (
  id                    uuid,
  nome                  text,
  cnpj                  text,
  whatsapp              text,
  telefone_responsavel  text,
  email                 text,
  responsavel           text,
  endereco_texto        text,
  cidade                text,
  uf                    text,
  latitude              numeric,
  longitude             numeric,
  faz_entrega           boolean,
  faz_retirada          boolean,
  raio_entrega_km       numeric,
  taxa_entrega          numeric,
  plano                 text,
  assinatura_status     text,
  assinatura_vencimento date,
  logo_url              text,
  itens_com_preco       integer,
  criado_em             timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not sou_admin() then
    raise exception 'Esta conta não é de administrador.';
  end if;

  return query
    select r.id, r.nome, r.cnpj, r.whatsapp, r.telefone_responsavel,
           (select au.email::text
              from usuarios u join auth.users au on au.id = u.auth_id
             where u.revenda_id = r.id and u.perfil = 'dono'
             order by u.criado_em limit 1),
           (select u.nome
              from usuarios u
             where u.revenda_id = r.id and u.perfil = 'dono'
             order by u.criado_em limit 1),
           r.endereco_texto, r.cidade, r.uf, r.latitude, r.longitude,
           r.faz_entrega, r.faz_retirada, r.raio_entrega_km, r.taxa_entrega,
           r.plano, r.assinatura_status, r.assinatura_vencimento, r.logo_url,
           (select count(*)::integer from precos p where p.revenda_id = r.id and p.disponivel),
           r.criado_em
      from revendas r
     order by case r.assinatura_status
                when 'aguardando_pagamento' then 0
                when 'suspensa' then 1
                when 'ativa' then 2
                else 3
              end,
              lower(r.nome);
end;
$$;


-- ------------------------------------------------------------
-- O que a revenda mostra na busca: preços e horários
-- ------------------------------------------------------------
create or replace function admin_detalhe(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not sou_admin() then
    raise exception 'Esta conta não é de administrador.';
  end if;

  return jsonb_build_object(
    'precos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item', i.nome,
               'tipo', i.tipo,
               'preco', p.preco,
               'disponivel', p.disponivel,
               'atualizado_em', p.atualizado_em
             ) order by i.tipo desc, i.ordem)
        from precos p join itens i on i.id = p.item_id
       where p.revenda_id = p_id
    ), '[]'::jsonb),
    'horarios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', h.dia,
               'tipo', h.tipo,
               'abre', to_char(h.abre, 'HH24:MI'),
               'fecha', to_char(h.fecha, 'HH24:MI'),
               'fechado', h.fechado
             ) order by h.tipo, h.dia)
        from horarios h
       where h.revenda_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;


-- ------------------------------------------------------------
-- Editar
--
-- Recebe só os campos que mudaram, num objeto. Campo que não
-- veio fica como está. As travas da tabela continuam valendo:
-- raio fora do limite ou estado fora da lista são recusados pelo
-- próprio banco, com a mensagem dele.
--
-- O CNPJ e a coordenada ficam de fora de propósito. CNPJ é a
-- identidade da revenda na cobrança; a coordenada decide quem a
-- vê, e mudar de lugar pede conferir o endereço no mapa, o que
-- esta tela não faz.
-- ------------------------------------------------------------
create or replace function admin_editar_revenda(p_id uuid, p_dados jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not sou_admin() then
    raise exception 'Esta conta não é de administrador.';
  end if;

  update revendas r set
    nome                  = coalesce(nullif(trim(p_dados->>'nome'), ''), r.nome),
    whatsapp              = coalesce(nullif(regexp_replace(p_dados->>'whatsapp', '\D', '', 'g'), ''), r.whatsapp),
    telefone_responsavel  = coalesce(regexp_replace(p_dados->>'telefone_responsavel', '\D', '', 'g'), r.telefone_responsavel),
    endereco_texto        = coalesce(nullif(trim(p_dados->>'endereco_texto'), ''), r.endereco_texto),
    cidade                = case when p_dados ? 'cidade' then nullif(trim(p_dados->>'cidade'), '') else r.cidade end,
    uf                    = case when p_dados ? 'uf' then nullif(upper(trim(p_dados->>'uf')), '') else r.uf end,
    faz_entrega           = coalesce((p_dados->>'faz_entrega')::boolean, r.faz_entrega),
    faz_retirada          = coalesce((p_dados->>'faz_retirada')::boolean, r.faz_retirada),
    raio_entrega_km       = coalesce((p_dados->>'raio_entrega_km')::numeric, r.raio_entrega_km),
    taxa_entrega          = coalesce((p_dados->>'taxa_entrega')::numeric, r.taxa_entrega),
    plano                 = coalesce(nullif(p_dados->>'plano', ''), r.plano),
    assinatura_vencimento = case when p_dados ? 'assinatura_vencimento'
                                 then nullif(p_dados->>'assinatura_vencimento', '')::date
                                 else r.assinatura_vencimento end
  where r.id = p_id;

  if not found then
    raise exception 'Revenda não encontrada.';
  end if;

  -- O nome do dono mora em `usuarios`, e não na revenda.
  if nullif(trim(p_dados->>'responsavel'), '') is not null then
    update usuarios u set nome = trim(p_dados->>'responsavel')
     where u.revenda_id = p_id and u.perfil = 'dono';
  end if;
end;
$$;


-- ------------------------------------------------------------
-- Mudar a situação sem mexer no vencimento
--
--   'suspensa'             — bloqueada: some da busca, e o dono
--                            ainda entra no painel e vê o motivo
--   'cancelada'            — encerrada
--   'aguardando_pagamento' — volta para a fila de quem vai pagar
--
-- 'ativa' não passa por aqui: liberar é o ativar_revenda(), que
-- calcula o vencimento. Reativar sem vencimento deixaria a
-- revenda no ar sem data para sair.
-- ------------------------------------------------------------
create or replace function admin_mudar_situacao(p_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not sou_admin() then
    raise exception 'Esta conta não é de administrador.';
  end if;

  if p_status not in ('suspensa', 'cancelada', 'aguardando_pagamento') then
    raise exception 'Situação inválida: %. Para liberar, use ativar_revenda.', p_status;
  end if;

  update revendas set assinatura_status = p_status where id = p_id;

  if not found then
    raise exception 'Revenda não encontrada.';
  end if;
end;
$$;


-- ------------------------------------------------------------
-- Apagar, de vez
--
-- Sai a revenda, e com ela preços, horários e usuários (as
-- chaves estrangeiras apagam em cascata). Sai também o acesso de
-- quem só entrava por ela: conta sem revenda é um login que abre
-- um painel vazio.
--
-- Não tem volta. A tela pede o nome digitado antes de chamar.
-- ------------------------------------------------------------
create or replace function admin_apagar_revenda(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  v_contas uuid[];
begin
  if not sou_admin() then
    raise exception 'Esta conta não é de administrador.';
  end if;

  select coalesce(array_agg(u.auth_id), '{}')
    into v_contas
    from usuarios u
   where u.revenda_id = p_id
     and u.auth_id is not null
     -- Nunca a conta de um administrador, mesmo que ela esteja
     -- ligada à revenda por algum teste.
     and not exists (select 1 from administradores a where a.auth_id = u.auth_id);

  delete from revendas where id = p_id;

  if not found then
    raise exception 'Revenda não encontrada.';
  end if;

  delete from auth.users where id = any (v_contas);
end;
$$;


-- ------------------------------------------------------------
-- Quem pode chamar: só quem está logado. A conferência de
-- administrador é a primeira linha de cada função.
-- ------------------------------------------------------------
revoke all on function admin_revendas()                   from public, anon;
revoke all on function admin_detalhe(uuid)                from public, anon;
revoke all on function admin_editar_revenda(uuid, jsonb)  from public, anon;
revoke all on function admin_mudar_situacao(uuid, text)   from public, anon;
revoke all on function admin_apagar_revenda(uuid)         from public, anon;

grant execute on function admin_revendas()                  to authenticated;
grant execute on function admin_detalhe(uuid)               to authenticated;
grant execute on function admin_editar_revenda(uuid, jsonb) to authenticated;
grant execute on function admin_mudar_situacao(uuid, text)  to authenticated;
grant execute on function admin_apagar_revenda(uuid)        to authenticated;
