-- ============================================================
-- 004-taxa-e-pagamento.sql
--
-- Duas coisas que o cliente precisa saber ANTES de chamar no
-- WhatsApp, e que faltavam:
--
--   1. se tem taxa de entrega, e de quanto
--   2. como a revenda aceita receber
--
-- As duas voltam na busca. Taxa descoberta só na conversa é pedido
-- desistido; e cartão recusado na porta é o entregador voltando com
-- o botijão.
--
-- Rode inteiro no SQL Editor, depois do 003.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. As colunas
--
-- Taxa zero é entrega grátis, e é o padrão: quem já estava
-- cadastrado não passa a cobrar nada sem ter dito.
--
-- As formas de pagamento começam com as quatro marcadas, pelo mesmo
-- motivo — ninguém some da escolha do cliente por uma coluna nova.
-- O dono desmarca no painel o que não aceita.
-- ------------------------------------------------------------
alter table revendas
  add column if not exists taxa_entrega numeric(10,2) not null default 0
    check (taxa_entrega >= 0);

alter table revendas
  add column if not exists pagamentos text[] not null
    default array['pix', 'debito', 'credito', 'dinheiro']
    -- Só as quatro que a tela conhece, e pelo menos uma: revenda que
    -- não aceita forma nenhuma não tem como vender.
    check (pagamentos <@ array['pix', 'debito', 'credito', 'dinheiro']
           and cardinality(pagamentos) > 0);


-- ------------------------------------------------------------
-- 2. A busca devolve as duas
--
-- O formato da resposta muda, e o Postgres não deixa trocar o
-- retorno com "create or replace": a função sai e volta.
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
           p.faz_entrega, p.faz_retirada, p.taxa_entrega, p.pagamentos
  order by
    count(pr.item_id) = array_length(p_itens, 1) desc,
    p.km asc;
$$;

-- A função saiu e voltou: a permissão de chamá-la voltou junto não.
grant execute on function buscar(numeric, numeric, uuid[], text, numeric) to anon, authenticated;

commit;
