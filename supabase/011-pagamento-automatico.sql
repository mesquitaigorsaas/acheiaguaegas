-- ============================================================
-- ACHEI ÁGUA & GÁS
-- 011-pagamento-automatico.sql
--
-- A assinatura passa a ser paga e liberada sem ninguém no meio.
--
-- A revenda paga com cartão ou Pix pelo Mercado Pago, dentro do
-- site. A Edge Function pagar-assinatura cobra; a
-- webhook-mercadopago recebe o aviso quando o Pix cai. As duas
-- chamam creditar_pagamento(), que é a única porta que estende o
-- vencimento.
--
-- Quatro partes:
--
--   1. A assinatura deixa de ser editável pelo dono. Antes deste
--      arquivo, a política "o dono edita a revenda dele" deixava
--      qualquer revenda logada gravar assinatura_status = 'ativa'
--      direto pela API, sem pagar nada.
--   2. A situação 'vencida', separada de 'suspensa'. Suspensa é
--      bloqueio do administrador, e pagar não pode desfazer isso.
--      Vencida é só falta de pagamento, e pagar resolve.
--   3. A tabela de pagamentos e a função que credita.
--   4. O vencimento que tira do ar sozinho, todo dia de madrugada.
--
-- Pode rodar mais de uma vez.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Só o sistema mexe na assinatura
--
-- O gatilho olha quem está gravando. Pelo navegador, o papel é
-- 'authenticated'. As funções do administrador e a creditar_
-- pagamento são security definer e gravam como o dono das
-- tabelas; as Edge Functions gravam como 'service_role'. Nenhum
-- desses dois cai aqui.
-- ------------------------------------------------------------
create or replace function proteger_assinatura()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.assinatura_status     is distinct from old.assinatura_status
    or new.assinatura_vencimento is distinct from old.assinatura_vencimento
    or new.plano                 is distinct from old.plano
    or new.assinatura_externa    is distinct from old.assinatura_externa
    or new.assinatura_link       is distinct from old.assinatura_link
  ) then
    raise exception 'A assinatura só muda pelo pagamento.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_assinatura on revendas;
create trigger proteger_assinatura
  before update on revendas
  for each row execute function proteger_assinatura();


-- ------------------------------------------------------------
-- 2. A situação 'vencida'
--
-- A trava antiga nasceu sem nome no schema.sql, então o Postgres
-- escolheu um. Procurar pelo conteúdo evita depender dele.
-- ------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  for v_nome in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.revendas'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) like '%assinatura_status%'
  loop
    execute format('alter table revendas drop constraint %I', v_nome);
  end loop;
end;
$$;

alter table revendas
  add constraint revendas_assinatura_status_check
  check (assinatura_status in ('ativa', 'aguardando_pagamento', 'vencida', 'suspensa', 'cancelada'));


-- O dia de hoje no Brasil. O banco roda em UTC, e às 22h de
-- Brasília já seria amanhã: quem vence hoje sairia do ar duas
-- horas antes da hora.
create or replace function hoje_no_brasil()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;


-- ------------------------------------------------------------
-- 3. Os pagamentos
--
-- Uma linha nasce antes de o Mercado Pago ser chamado, e o id dela
-- vai como external_reference. Quando o aviso chega, é por ele que
-- a gente sabe qual revenda, qual plano e quanto devia ter caído —
-- nada disso é lido do que o navegador mandou.
-- ------------------------------------------------------------
create table if not exists pagamentos (
  id                uuid primary key default gen_random_uuid(),
  revenda_id        uuid not null references revendas (id) on delete cascade,
  plano             text not null check (plano in ('mensal', 'anual')),
  valor             numeric(10, 2) not null check (valor > 0),

  -- 'credit_card', 'debit_card' ou 'bank_transfer' (o Pix).
  metodo            text,

  -- O id do pagamento no Mercado Pago. Único: o aviso chega
  -- repetido, e o segundo não pode virar um segundo crédito.
  gateway_id        text unique,

  status            text not null default 'pendente'
                    check (status in ('pendente', 'pago', 'cancelado', 'estornado')),

  -- Preenchido uma vez só, pela creditar_pagamento(). É a trava
  -- que impede o mesmo pagamento de estender o prazo duas vezes.
  creditado_em      timestamptz,
  vencimento_depois date,

  -- A resposta inteira do Mercado Pago, para conferir reclamação.
  retorno           jsonb,

  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists idx_pagamentos_revenda on pagamentos (revenda_id, criado_em desc);

comment on table pagamentos is 'Cada cobrança da assinatura. Só as Edge Functions escrevem.';

alter table pagamentos enable row level security;

-- O dono enxerga os dele: é assim que a tela do Pix descobre que o
-- pagamento caiu. Ninguém escreve pelo navegador.
drop policy if exists "o dono vê os pagamentos dele" on pagamentos;
create policy "o dono vê os pagamentos dele"
  on pagamentos for select
  to authenticated
  using (revenda_id = minha_revenda());


-- ------------------------------------------------------------
-- Creditar
--
-- O prazo conta do vencimento que ainda não passou, ou de hoje —
-- quem renova adiantado não perde os dias que já tinha. É a mesma
-- conta do ativar_revenda(), do 006.
--
-- Suspensa e cancelada continuam como estão: foi o administrador
-- que decidiu, e pagar não desfaz a decisão dele. O prazo fica
-- estendido, para ele liberar sem cobrar de novo.
-- ------------------------------------------------------------
create or replace function creditar_pagamento(p_pagamento uuid)
returns date
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pagamento pagamentos;
  v_vencimento date;
  v_novo date;
begin
  select * into v_pagamento from pagamentos where id = p_pagamento for update;

  if not found then
    raise exception 'Pagamento não encontrado.';
  end if;

  if v_pagamento.status <> 'pago' then
    raise exception 'Este pagamento não está pago.';
  end if;

  if v_pagamento.creditado_em is not null then
    return v_pagamento.vencimento_depois;
  end if;

  select r.assinatura_vencimento into v_vencimento
    from revendas r
   where r.id = v_pagamento.revenda_id
     for update;

  v_novo := greatest(hoje_no_brasil(), coalesce(v_vencimento, hoje_no_brasil()))
            + (case when v_pagamento.plano = 'mensal'
                    then interval '1 month'
                    else interval '12 months' end);

  update revendas r
     set assinatura_vencimento = v_novo,
         plano = v_pagamento.plano,
         assinatura_status = case
           when r.assinatura_status in ('aguardando_pagamento', 'vencida', 'ativa') then 'ativa'
           else r.assinatura_status
         end
   where r.id = v_pagamento.revenda_id;

  update pagamentos
     set creditado_em = now(),
         vencimento_depois = v_novo,
         atualizado_em = now()
   where id = p_pagamento;

  return v_novo;
end;
$$;

revoke all on function creditar_pagamento(uuid) from public, anon, authenticated;
grant execute on function creditar_pagamento(uuid) to service_role;


-- ------------------------------------------------------------
-- 4. Vencer
--
-- Roda todo dia às 00:05 de Brasília (03:05 em UTC). Quem venceu
-- ontem sai da busca, e o login passa a mostrar a tela de pagar.
-- ------------------------------------------------------------
create or replace function vencer_assinaturas()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  update revendas
     set assinatura_status = 'vencida'
   where assinatura_status = 'ativa'
     and assinatura_vencimento is not null
     and assinatura_vencimento < hoje_no_brasil();

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function vencer_assinaturas() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule com o mesmo nome substitui o agendamento antigo, e
-- é por isso que este arquivo pode rodar de novo sem duplicar.
select cron.schedule(
  'vencer-assinaturas',
  '5 3 * * *',
  $$select public.vencer_assinaturas()$$
);

-- Quem já passou do prazo sai agora, sem esperar a madrugada.
select vencer_assinaturas();


-- ------------------------------------------------------------
-- O administrador também enxerga as vencidas
--
-- A lista dele (009) ordena por situação e cai no "resto" para
-- qualquer valor novo, então não precisa mudar. O mudar_situacao
-- aceita voltar uma vencida para "aguardando pagamento", do mesmo
-- jeito que as outras.
-- ------------------------------------------------------------
