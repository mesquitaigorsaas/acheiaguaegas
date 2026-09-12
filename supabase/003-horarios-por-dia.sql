-- ============================================================
-- 003-horarios-por-dia.sql
--
-- Três mudanças que vêm juntas porque mexem no mesmo lugar.
--
-- 1. HORÁRIO POR DIA, E SEPARADO POR TIPO
--
--    Antes era "faixa": um rótulo, uma lista de dias e uma hora.
--    Servia para "segunda a sábado, das 8 às 18", e não servia
--    para a vida real de uma revenda, onde o balcão abre às 7 e
--    a entrega só começa às 9; onde sábado fecha ao meio-dia
--    para entrega e às 13 para quem vai buscar.
--
--    Agora é uma linha por DIA e por TIPO. Sete dias, dois
--    tipos, catorze linhas no máximo. O dono preenche o que
--    existe e marca fechado no resto.
--
-- 2. O TIPO MANDA NA BUSCA
--
--    Quem pede entrega precisa saber se a ENTREGA está
--    funcionando agora, não se o balcão está aberto. São coisas
--    diferentes e a revenda sabe disso; o site é que não sabia.
--
-- 3. SAI O "PUBLICADO"
--
--    Quem pagou está no ar. Vencido, sai. Um interruptor a mais
--    era um jeito de o dono ficar invisível sem perceber — e um
--    suporte a mais para nós, explicando por telefone onde fica
--    o botão.
--
--    O medo de pôr no ar uma revenda sem preço se resolveu
--    sozinho: a busca cruza com a tabela de preços, então quem
--    não cadastrou nada não aparece em resultado nenhum.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A tabela nova
-- ------------------------------------------------------------
drop table if exists horarios;

create table horarios (
  id          uuid primary key default gen_random_uuid(),
  revenda_id  uuid not null references revendas(id) on delete cascade,

  -- Padrão do JavaScript: 0 é domingo, 6 é sábado. É o mesmo
  -- número que o navegador devolve, então não existe tradução no
  -- meio — e tradução no meio é onde nasce o erro de um dia.
  dia         smallint not null check (dia between 0 and 6),

  tipo        text not null check (tipo in ('entrega', 'retirada')),

  abre        time not null,
  fecha       time not null,

  -- Dia sem atendimento daquele tipo. Guardado como linha, e não
  -- como ausência de linha, para o painel poder mostrar o dia
  -- marcado como fechado em vez de um campo vazio que parece
  -- esquecimento.
  fechado     boolean not null default false,

  unique (revenda_id, dia, tipo)
);

create index idx_horarios_revenda on horarios (revenda_id, tipo, dia);

comment on table horarios is 'Uma linha por dia e por tipo. Entrega e balcão têm horários diferentes na vida real.';


-- ------------------------------------------------------------
-- 2. Está aberta AGORA, para este tipo de atendimento
--
-- O horário é comparado no fuso de Brasília, e não no do
-- servidor: o banco roda em UTC, e sem converter toda revenda
-- fecharia três horas mais cedo.
--
-- Fechamento menor ou igual à abertura quer dizer que a faixa
-- atravessa a meia-noite. Das 22:00 às 02:00 vira o dia, e
-- 00:00 nos dois é dia e noite.
-- ------------------------------------------------------------
drop function if exists esta_aberta(uuid);

create or replace function esta_aberta(p_revenda uuid, p_tipo text default 'entrega')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with agora as (select (now() at time zone 'America/Sao_Paulo') as t)
  select exists (
    select 1
      from horarios h, agora a
     where h.revenda_id = p_revenda
       and h.tipo = p_tipo
       and not h.fechado
       and (
         (h.fecha > h.abre
          and h.dia = extract(dow from a.t)::smallint
          and a.t::time >= h.abre and a.t::time < h.fecha)
         or
         -- Atravessa a meia-noite. Antes de fechar, o dia que
         -- conta é o de ONTEM: quem abriu sábado às 22h e fecha
         -- às 2h ainda está no turno de sábado.
         (h.fecha <= h.abre
          and (
            (h.dia = extract(dow from a.t)::smallint and a.t::time >= h.abre)
            or
            (h.dia = extract(dow from a.t - interval '1 day')::smallint and a.t::time < h.fecha)
          ))
       )
  );
$$;

grant execute on function esta_aberta(uuid, text) to anon, authenticated;


-- ------------------------------------------------------------
-- 3. Fora o "publicado"
--
-- Quem paga aparece. A coluna sai para não sobrar interruptor
-- que ninguém liga e que faz a revenda sumir sem explicação.
-- ------------------------------------------------------------
alter table revendas drop column if exists publicado;

drop index if exists idx_revendas_no_ar;
create index idx_revendas_no_ar on revendas (assinatura_status, latitude);


-- ------------------------------------------------------------
-- 4. A busca, acertada para as duas coisas
-- ------------------------------------------------------------
create or replace function buscar(
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
       -- e longitude. Um grau de latitude tem 111 km. Calcular a
       -- distância de todas as revendas do país para depois
       -- jogar fora é trabalho à toa.
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
    -- Aberta PARA O QUE A PESSOA PEDIU. Quem quer entrega não
    -- precisa saber se o balcão está aberto.
    esta_aberta(p.id, p_modo),
    p.faz_entrega,
    p.faz_retirada,
    count(pr.item_id)::integer,
    coalesce(sum(pr.preco), 0),
    coalesce(jsonb_object_agg(pr.item_id, pr.preco) filter (where pr.item_id is not null), '{}'::jsonb)
  from perto p
  join precos pr
    on pr.revenda_id = p.id
   and pr.item_id = any (p_itens)
   and pr.disponivel
  -- Na entrega, o corte é pelo MENOR entre o raio dela e o teto
  -- pedido. Na retirada o raio dela não vale: quem dirige até lá
  -- decide sozinho até onde vai.
  where p.km <= case when p_modo = 'retirada'
                     then p_raio_max
                     else least(p.raio_entrega_km, p_raio_max)
                end
  group by p.id, p.nome, p.logo_url, p.whatsapp, p.endereco_texto, p.km,
           p.faz_entrega, p.faz_retirada
  -- Tem tudo, depois a mais perto. Estar aberta não ordena:
  -- horário de revenda muda, e jogar a mais perto para o fim por
  -- causa de um cadastro desatualizado esconde quem resolveria o
  -- problema.
  order by
    count(pr.item_id) = array_length(p_itens, 1) desc,
    p.km asc;
$$;


-- ------------------------------------------------------------
-- 5. As regras de segurança da tabela nova
-- ------------------------------------------------------------
alter table horarios enable row level security;

-- O visitante não lê: quem responde se está aberta é a função,
-- que roda com direitos próprios. A tela recebe sim ou não, e
-- não a agenda da revenda.

create policy "o dono lê os horários dele"
  on horarios for select to authenticated
  using (revenda_id = minha_revenda());

create policy "o dono cria horário na revenda dele"
  on horarios for insert to authenticated
  with check (revenda_id = minha_revenda());

create policy "o dono edita o horário dele"
  on horarios for update to authenticated
  using (revenda_id = minha_revenda())
  with check (revenda_id = minha_revenda());

create policy "o dono apaga o horário dele"
  on horarios for delete to authenticated
  using (revenda_id = minha_revenda());


-- ------------------------------------------------------------
-- 6. Um horário de partida para quem já está cadastrado
--
-- Segunda a sábado, 8 às 18, nos dois tipos. É palpite, e o dono
-- corrige no painel — mas revenda sem nenhuma linha apareceria
-- fechada para sempre, e ele não descobriria por quê.
-- ------------------------------------------------------------
insert into horarios (revenda_id, dia, tipo, abre, fecha, fechado)
select r.id, d.dia, t.tipo, '08:00', '18:00', d.dia = 0
  from revendas r
  cross join (select generate_series(0, 6) as dia) d
  cross join (select unnest(array['entrega', 'retirada']) as tipo) t
on conflict (revenda_id, dia, tipo) do nothing;
