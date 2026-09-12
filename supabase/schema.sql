-- ============================================================
-- ACHEI ÁGUA & GÁS — ESTRUTURA DO BANCO
--
-- Um site só, várias revendas anunciando. O cliente diz onde
-- está, e o banco responde quem entrega ali, está aberto agora,
-- e por quanto.
--
-- A diferença para o Cardápio Online, que é o molde da casa:
-- lá o cliente chega sabendo de qual comércio quer comprar, e
-- cada assinante tem o seu endereço. Aqui existe uma busca só, e
-- os assinantes disputam entre si. Por isso duas coisas que lá
-- não existiam: raio de entrega e catálogo fechado de itens.
--
-- Rode este arquivo primeiro, depois o policies.sql.
-- ============================================================


-- ------------------------------------------------------------
-- REVENDAS — os assinantes
--
-- Guardamos latitude e longitude, e não só o endereço escrito.
-- Endereço em texto não se compara com nada: para dizer "2,3 km
-- daqui" é preciso número, e quem converte um no outro é o mapa,
-- uma vez só, na hora do cadastro.
-- ------------------------------------------------------------
create table revendas (
  id                    uuid primary key default gen_random_uuid(),

  nome                  text not null,
  logo_url              text,

  -- Só os 14 dígitos, sem ponto, barra nem traço. Guardar com
  -- máscara faz o mesmo CNPJ entrar duas vezes escrito de dois
  -- jeitos, e a trava de único deixa de travar.
  cnpj                  text not null unique
                        check (cnpj ~ '^[0-9]{14}$'),

  -- O WhatsApp que recebe o pedido. Guardado sem o 55: o código
  -- do país entra na hora de montar o link, como nos outros
  -- projetos da casa. Pedir que o dono digite o 55 é pedir para
  -- ele errar, e número torto aqui é pedido que nunca chega.
  whatsapp              text not null,

  -- O telefone do dono, para o suporte falar de cobrança. Nunca
  -- aparece para o cliente: aquele lá em cima fica no balcão, com
  -- quem estiver no turno.
  telefone_responsavel  text not null default '',

  endereco_texto        text not null,
  latitude              numeric(10, 7) not null,
  longitude             numeric(10, 7) not null,

  -- ENTREGA E RETIRADA — as duas perguntas que decidem se a
  -- revenda serve para aquela pessoa.
  --
  -- Nem toda revenda entrega: muita gente vende só no balcão, e o
  -- cliente vai buscar de carro ou de moto. Sem estas colunas o
  -- site manda alguém esperar em casa uma entrega que nunca vem,
  -- e quem leva a culpa é o site, não a revenda.
  --
  -- As duas podem ser verdadeiras ao mesmo tempo, e quase sempre
  -- são. O que não pode é as duas serem falsas: revenda que não
  -- entrega nem atende no balcão não vende para ninguém.
  faz_entrega           boolean not null default true,
  faz_retirada          boolean not null default true,
  constraint vende_de_algum_jeito check (faz_entrega or faz_retirada),

  -- Até onde ela entrega. Não basta estar perto do cliente: quem
  -- está a oito quilômetros e entrega em dez atende; quem está a
  -- dois e entrega em um, não. Sem esta coluna a busca mostraria
  -- gente que vai recusar o pedido, e a culpa ficaria com o site.
  --
  -- Só vale para a entrega. Quem vai buscar dirige o quanto quiser.
  raio_entrega_km       numeric(5, 1) not null default 5
                        check (raio_entrega_km > 0 and raio_entrega_km <= 60),

  -- O freio do dono: despublicada, ela some da busca mesmo com a
  -- assinatura em dia. Serve para quem ainda está cadastrando os
  -- preços, e para quem vai fechar por uns dias.
  publicado             boolean not null default false,

  -- O freio do dono do sistema. Mesma regra dos outros projetos:
  -- 'ativa' libera, qualquer outra coisa tira do ar.
  assinatura_status     text not null default 'aguardando_pagamento'
                        check (assinatura_status in ('ativa', 'aguardando_pagamento', 'suspensa', 'cancelada')),
  assinatura_vencimento date,
  plano                 text not null default 'mensal',
  assinatura_externa    text,
  assinatura_link       text,

  criado_em             timestamptz not null default now()
);

-- A busca varre por latitude antes de calcular distância, então é
-- por ela que o índice ajuda.
create index idx_revendas_no_ar on revendas (publicado, assinatura_status, latitude);

comment on table revendas is 'Os assinantes. Quem aparece na busca do cliente.';
comment on column revendas.raio_entrega_km is 'Até onde entrega. Só vale para entrega: quem vai buscar dirige o quanto quiser.';
comment on column revendas.faz_entrega is 'Leva até o cliente. Falso quer dizer balcão só.';
comment on column revendas.faz_retirada is 'Atende quem vai buscar no balcão.';


-- ------------------------------------------------------------
-- ITENS — o catálogo, que é NOSSO e não do anunciante
--
-- Se cada revenda escrevesse o nome do produto do seu jeito,
-- "P13", "botijão 13" e "gás 13 kg" virariam três coisas
-- diferentes, e nenhum preço seria comparável. Comparar preço é o
-- produto inteiro deste site, então o nome do item não pode ser
-- campo de texto livre.
--
-- O dono não cria item. Ele marca quais desta lista ele vende, e
-- por quanto.
-- ------------------------------------------------------------
create table itens (
  id        uuid primary key default gen_random_uuid(),

  tipo      text not null check (tipo in ('gas', 'agua')),

  nome      text not null,
  -- Como o cliente fala na rua. Vai no filtro e no botão, onde
  -- não cabe o nome inteiro.
  apelido   text not null default '',

  ordem     integer not null default 0,
  ativo     boolean not null default true,

  unique (tipo, nome)
);

create index idx_itens_lista on itens (tipo, ativo, ordem);


-- ------------------------------------------------------------
-- PREÇOS — o que cada revenda cobra por cada item
--
-- Uma linha por revenda e item. A trava de unicidade impede o
-- mesmo item aparecer duas vezes com preços diferentes na mesma
-- revenda, que na tela viraria o cliente escolhendo em qual
-- acreditar.
-- ------------------------------------------------------------
create table precos (
  id            uuid primary key default gen_random_uuid(),
  revenda_id    uuid not null references revendas(id) on delete cascade,
  item_id       uuid not null references itens(id)    on delete cascade,

  preco         numeric(10, 2) not null check (preco >= 0),

  -- Acabou o estoque hoje? Desmarca e o item some da busca sem
  -- ser apagado. Amanhã volta com um clique — e o preço, que dá
  -- trabalho de digitar, não se perde.
  disponivel    boolean not null default true,

  atualizado_em timestamptz not null default now(),

  unique (revenda_id, item_id)
);

create index idx_precos_busca on precos (item_id, disponivel);

comment on column precos.atualizado_em is 'Quando o dono mexeu no preço pela última vez. Preço velho é reclamação na certa.';


-- ------------------------------------------------------------
-- HORÁRIOS — quando a revenda está aberta
--
-- `dias_semana` guarda o padrão do JavaScript, onde domingo é 0 e
-- sábado é 6. É o mesmo número que o navegador devolve, então não
-- existe tradução no meio — e tradução no meio é onde nasce o
-- erro de um dia.
-- ------------------------------------------------------------
create table horarios (
  id          uuid primary key default gen_random_uuid(),
  revenda_id  uuid not null references revendas(id) on delete cascade,

  rotulo      text not null,
  dias_semana smallint[] not null
              check (array_length(dias_semana, 1) between 1 and 7)
              check (dias_semana <@ array[0,1,2,3,4,5,6]::smallint[]),
  abre        time not null,
  fecha       time not null,

  ordem       integer not null default 0
);

create index idx_horarios_revenda on horarios (revenda_id);

comment on column horarios.dias_semana is 'Padrão do JavaScript: 0 é domingo, 6 é sábado.';


-- ------------------------------------------------------------
-- USUARIOS — quem entra no painel
-- ------------------------------------------------------------
create table usuarios (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete cascade,
  revenda_id  uuid not null references revendas(id) on delete cascade,

  nome        text not null,
  perfil      text not null default 'dono' check (perfil in ('dono', 'atendente')),
  ativo       boolean not null default true,

  criado_em   timestamptz not null default now()
);

create index idx_usuarios_revenda on usuarios (revenda_id);


-- ============================================================
-- AS PERGUNTAS QUE O BANCO RESPONDE
-- ============================================================

-- ------------------------------------------------------------
-- A revenda está no ar?
--
-- Duas condições, e as duas precisam valer: o dono publicou, e a
-- assinatura está em dia. Escrever isso uma vez aqui evita
-- repetir a regra em cada política de segurança — e evita que uma
-- delas fique para trás no dia em que a regra mudar.
-- ------------------------------------------------------------
create or replace function revenda_no_ar(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from revendas r
     where r.id = p_id
       and r.publicado
       and r.assinatura_status = 'ativa'
  );
$$;


-- ------------------------------------------------------------
-- Quantos quilômetros separam dois pontos
--
-- Fórmula de Haversine, que trata a Terra como esfera. O erro
-- dela é de meio por cento, ou cinco metros num quilômetro —
-- irrelevante para dizer "a 2,3 km daqui", e bem mais simples do
-- que instalar PostGIS por causa disto.
-- ------------------------------------------------------------
create or replace function distancia_km(
  lat1 numeric, lon1 numeric,
  lat2 numeric, lon2 numeric
)
returns numeric
language sql
immutable
as $$
  select round((
    6371 * acos(
      least(1, greatest(-1,
        cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2) - radians(lon1))
        + sin(radians(lat1)) * sin(radians(lat2))
      ))
    )
  )::numeric, 2);
$$;

comment on function distancia_km is 'Haversine. O least/greatest existe porque erro de arredondamento pode passar de 1 e o acos estourar.';


-- ------------------------------------------------------------
-- A revenda está aberta AGORA?
--
-- O horário é comparado no fuso de Brasília, e não no do
-- servidor: o banco roda em UTC, e sem converter toda revenda
-- fecharia três horas mais cedo.
--
-- Fechamento menor ou igual à abertura quer dizer que a faixa
-- vira a meia-noite: "das 18:00 às 00:00" é até o fim do dia, e
-- "das 22:00 às 02:00" atravessa para o dia seguinte.
-- ------------------------------------------------------------
create or replace function esta_aberta(p_revenda uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with agora as (
    select (now() at time zone 'America/Sao_Paulo') as t
  )
  select exists (
    select 1
      from horarios h, agora a
     where h.revenda_id = p_revenda
       and (
         -- Faixa que começa e termina no mesmo dia.
         (h.fecha > h.abre
          and extract(dow from a.t)::smallint = any (h.dias_semana)
          and a.t::time >= h.abre and a.t::time < h.fecha)
         or
         -- Faixa que atravessa a meia-noite. Antes de fechar, o
         -- dia que conta é o de ONTEM: quem abriu sábado às 22h e
         -- fecha 2h da manhã ainda está no turno de sábado.
         (h.fecha <= h.abre
          and (
            (extract(dow from a.t)::smallint = any (h.dias_semana) and a.t::time >= h.abre)
            or
            ((extract(dow from a.t - interval '1 day'))::smallint = any (h.dias_semana) and a.t::time < h.fecha)
          ))
       )
  );
$$;


-- ------------------------------------------------------------
-- A BUSCA — o coração do site
--
-- Recebe uma LISTA de itens, e não um só. Quem está com o
-- botijão vazio muitas vezes também está com o galão vazio, e
-- fazer duas buscas para pedir de uma revenda só é trabalho que
-- o site deveria poupar.
--
-- Recebe também COMO a pessoa quer receber. São duas buscas
-- diferentes vestidas de uma:
--
--   'entrega'  — só quem entrega, e só dentro do raio DELA. O
--                raio é a promessa que ela fez; fora dele, ela
--                recusa o pedido e a culpa fica com o site.
--
--   'retirada' — só quem atende no balcão, e o raio dela não
--                importa: quem vai buscar dirige o quanto quiser.
--                Vale um teto maior, porque a pessoa aceita rodar
--                para economizar ou porque é o único aberto.
--
-- É uma FUNÇÃO, e não uma consulta direta à tabela, de propósito.
-- Com leitura livre em `revendas`, qualquer visitante baixaria a
-- lista inteira de assinantes com um comando — que é a carteira
-- de clientes do negócio servida a um concorrente.
--
-- A ORDEM é: tem tudo, depois a mais perto. Só isso.
--
-- Tem tudo primeiro porque o pedido inteiro numa entrega só é o
-- motivo de existir a lista de itens. E perto em seguida, porque
-- é o que quem está sem gás quer.
--
-- ESTAR ABERTA NÃO ORDENA, e isso é escolha. Horário de revenda
-- muda, atrasa, abre no feriado que o cadastro não previu. Jogar
-- a mais perto para o fim da lista por causa de um horário que
-- pode estar desatualizado esconde justamente quem resolveria o
-- problema. O selo diz se está aberta, e quem decide se liga
-- assim mesmo é o cliente.
--
-- O PREÇO NÃO ORDENA. Ele aparece, e a tela marca a mais barata,
-- mas quem escolhe entre economizar cinco reais e esperar menos
-- é o cliente, não nós.
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
     where r.publicado
       and r.assinatura_status = 'ativa'
       and (case when p_modo = 'retirada' then r.faz_retirada else r.faz_entrega end)
       -- Recorte grosseiro primeiro, por um quadrado de latitude e
       -- longitude. Um grau de latitude tem 111 km. Calcular a
       -- distância de todas as revendas do país para depois jogar
       -- fora é trabalho à toa quando o índice resolve antes.
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
    esta_aberta(p.id),
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
  -- pedido. Na retirada, o raio dela não tem nada a ver: quem
  -- dirige até lá decide sozinho até onde vai.
  where p.km <= case when p_modo = 'retirada'
                     then p_raio_max
                     else least(p.raio_entrega_km, p_raio_max)
                end
  group by p.id, p.nome, p.logo_url, p.whatsapp, p.endereco_texto, p.km,
           p.faz_entrega, p.faz_retirada
  order by
    count(pr.item_id) = array_length(p_itens, 1) desc,
    p.km asc;
$$;

comment on function buscar is 'A busca do cliente. Única porta de leitura das revendas para quem não está logado.';
