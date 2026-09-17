-- ============================================================
-- 010-extras.sql — o que a revenda vende além de gás e água
--
-- Rode inteiro no SQL Editor, depois do 009.
--
-- Acessórios, carvão, gelo e bebidas. Sem preço: a revenda só
-- marca que vende, e o cliente pergunta o valor no WhatsApp.
--
-- Uma coluna com a lista, e não uma tabela de preços: estes itens
-- não entram na conta do pedido nem na ordem de "mais barata". São
-- informação, e uma lista marcada basta.
--
-- A lista de chaves é a mesma do js/extras.js.
-- ============================================================

begin;

alter table revendas
  add column if not exists extras text[] not null default '{}';

alter table revendas drop constraint if exists extras_validos;

alter table revendas
  add constraint extras_validos check (extras <@ array[
    'suporte_galao', 'bomba_galao', 'vela_filtro',
    'mangueira_gas', 'registro_gas', 'abracadeira',
    'carvao', 'gelo',
    'refrigerante', 'cerveja', 'copos'
  ]::text[]);

comment on column revendas.extras is 'O que vende além do catálogo, sem preço. Chaves de js/extras.js.';


-- ------------------------------------------------------------
-- A busca devolve os extras, para o cartão mostrar "também vende".
-- O retorno muda, então a função sai e volta com a permissão.
-- ------------------------------------------------------------
drop function if exists buscar(numeric, numeric, uuid[], text, numeric);

create function buscar(
  p_lat      numeric,
  p_lon      numeric,
  p_itens    uuid[],
  p_modo     text default 'entrega',
  p_raio_max numeric default 30
)
returns table (
  revenda_id        uuid,
  nome              text,
  logo_url          text,
  whatsapp          text,
  endereco          text,
  distancia_km      numeric,
  aberta            boolean,
  faz_entrega       boolean,
  faz_retirada      boolean,
  taxa_entrega      numeric,
  pagamentos        text[],
  extras            text[],
  itens_encontrados integer,
  total             numeric,
  precos            jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with perto as (
    select r.*, distancia_km(p_lat, p_lon, r.latitude, r.longitude) as km
      from revendas r
     where r.assinatura_status = 'ativa'
       and (case when p_modo = 'retirada' then r.faz_retirada else r.faz_entrega end)
       -- Recorte grosseiro primeiro, por um quadrado de latitude
       -- e longitude. Um grau de latitude tem 111 km.
       and r.latitude  between p_lat - (p_raio_max / 111.0) and p_lat + (p_raio_max / 111.0)
       and r.longitude between p_lon - (p_raio_max / 111.0) and p_lon + (p_raio_max / 111.0)
  )
  select
    p.id,
    p.nome,
    p.logo_url,
    p.whatsapp,
    p.endereco_texto,
    p.km,
    esta_aberta(p.id, p_modo),
    p.faz_entrega,
    p.faz_retirada,
    p.taxa_entrega,
    p.pagamentos,
    p.extras,
    count(pr.item_id)::integer,
    coalesce(sum(pr.preco), 0),
    coalesce(jsonb_object_agg(pr.item_id, pr.preco) filter (where pr.item_id is not null), '{}'::jsonb)
  from perto p
  join precos pr
    on pr.revenda_id = p.id
   and pr.item_id = any (p_itens)
   and pr.disponivel
  where p.km <= case when p_modo = 'retirada'
                     then p_raio_max
                     else least(p.raio_entrega_km, p_raio_max)
                end
  group by p.id, p.nome, p.logo_url, p.whatsapp, p.endereco_texto, p.km,
           p.faz_entrega, p.faz_retirada, p.taxa_entrega, p.pagamentos, p.extras
  order by
    count(pr.item_id) = array_length(p_itens, 1) desc,
    p.km asc;
$$;

grant execute on function buscar(numeric, numeric, uuid[], text, numeric) to anon, authenticated;


-- ------------------------------------------------------------
-- O administrador vê os extras de cada revenda.
-- ------------------------------------------------------------
drop function if exists admin_revendas();

create function admin_revendas()
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
  extras                text[],
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
           r.extras,
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

revoke all on function admin_revendas() from public, anon;
grant execute on function admin_revendas() to authenticated;

commit;
