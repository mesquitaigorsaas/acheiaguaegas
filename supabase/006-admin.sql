-- ============================================================
-- 006-admin.sql — ativar revenda pelo celular
--
-- Rode DEPOIS do policies.sql.
--
-- O problema: quem paga por Pix manda o comprovante pelo
-- WhatsApp, e alguém precisa dizer ao banco "esta pode entrar".
-- Até aqui isso só dava para fazer abrindo o painel do Supabase
-- no computador e editando a linha na mão.
--
-- A solução NÃO é abrir a tabela `revendas` para o navegador. As
-- regras do policies.sql deixam cada dono enxergar só a revenda
-- dele, de propósito: a tabela inteira é a carteira de clientes,
-- com nome, telefone e endereço de cada assinante.
--
-- Então o navegador ganha exatamente duas portas, e nada além:
--
--   revendas_pendentes()          — quem está esperando
--   ativar_revenda(id, plano)     — libera uma delas
--   desfazer_ativacao(id)         — o botão de arrependimento
--
-- As três rodam com direitos próprios (`security definer`) e a
-- primeira linha de cada uma pergunta se quem chamou é
-- administrador. Não sendo, a função para ali. Quem descobrir o
-- nome delas e chamá-las do console continua sem ver nada.
-- ============================================================


-- ------------------------------------------------------------
-- Quem é administrador
--
-- Uma tabela em vez de uma coluna em `usuarios`: administrador
-- não é dono de revenda nenhuma, e `usuarios.revenda_id` é
-- obrigatório. Forçar um vínculo falso só para marcar perfil
-- criaria uma revenda fantasma na carteira de clientes.
-- ------------------------------------------------------------
create table if not exists administradores (
  auth_id   uuid primary key references auth.users(id) on delete cascade,
  nome      text not null default '',
  criado_em timestamptz not null default now()
);

comment on table administradores is 'Quem pode ativar revenda pela tela de admin. Entra por SQL, nunca pelo site.';

alter table administradores enable row level security;

-- Nenhuma política: ninguém lê nem escreve esta tabela pelo
-- navegador. Só as funções abaixo a consultam, e elas rodam com
-- direitos próprios. Administrador novo entra por SQL.


create or replace function sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from administradores a where a.auth_id = auth.uid()
  );
$$;


-- ------------------------------------------------------------
-- A lista da tela
--
-- Traz quem ainda não pagou e quem foi suspensa: são as duas
-- situações em que existe um botão a apertar. Revenda ativa e em
-- dia não aparece, porque não há o que fazer com ela.
--
-- O telefone do responsável vem junto: é por ele que se fala de
-- cobrança quando o comprovante não bate.
-- ------------------------------------------------------------
create or replace function revendas_pendentes()
returns table (
  id                    uuid,
  nome                  text,
  cnpj                  text,
  whatsapp              text,
  telefone_responsavel  text,
  endereco_texto        text,
  plano                 text,
  assinatura_status     text,
  assinatura_vencimento date,
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
           r.endereco_texto, r.plano, r.assinatura_status,
           r.assinatura_vencimento, r.criado_em
      from revendas r
     where r.assinatura_status in ('aguardando_pagamento', 'suspensa')
     order by r.criado_em;
end;
$$;


-- ------------------------------------------------------------
-- Ativar
--
-- O vencimento conta a partir de hoje, ou do vencimento que
-- ainda não passou — quem paga adiantado não perde os dias que
-- já tinha.
--
-- Devolve a linha atualizada para a tela mostrar a data sem
-- precisar perguntar de novo.
-- ------------------------------------------------------------
create or replace function ativar_revenda(p_id uuid, p_plano text default null)
returns table (id uuid, nome text, assinatura_status text, assinatura_vencimento date, plano text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_plano  text;
  v_inicio date;
begin
  if not sou_admin() then
    raise exception 'Esta conta não é de administrador.';
  end if;

  select coalesce(nullif(p_plano, ''), r.plano) into v_plano
    from revendas r where r.id = p_id;

  if v_plano is null then
    raise exception 'Revenda não encontrada.';
  end if;

  if v_plano not in ('mensal', 'anual') then
    raise exception 'Plano inválido: %', v_plano;
  end if;

  select greatest(current_date, coalesce(r.assinatura_vencimento, current_date))
    into v_inicio
    from revendas r where r.id = p_id;

  return query
    update revendas r
       set assinatura_status = 'ativa',
           plano = v_plano,
           assinatura_vencimento = v_inicio + (case when v_plano = 'mensal'
                                                    then interval '1 month'
                                                    else interval '12 months' end)
     where r.id = p_id
    returning r.id, r.nome, r.assinatura_status, r.assinatura_vencimento, r.plano;
end;
$$;


-- ------------------------------------------------------------
-- Desfazer
--
-- Ativou a revenda errada na pressa? Volta para "aguardando
-- pagamento" e some da busca na hora. Sem isto, o conserto de um
-- toque errado exigiria abrir o painel do Supabase — que é
-- justamente o que esta tela veio evitar.
-- ------------------------------------------------------------
create or replace function desfazer_ativacao(p_id uuid)
returns table (id uuid, nome text, assinatura_status text)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not sou_admin() then
    raise exception 'Esta conta não é de administrador.';
  end if;

  return query
    update revendas r
       set assinatura_status = 'aguardando_pagamento',
           assinatura_vencimento = null
     where r.id = p_id
    returning r.id, r.nome, r.assinatura_status;
end;
$$;


-- ------------------------------------------------------------
-- Quem pode chamar
--
-- Só quem está logado. O visitante anônimo não enxerga nem o
-- nome das funções.
-- ------------------------------------------------------------
revoke all on function revendas_pendentes()      from anon, authenticated;
revoke all on function ativar_revenda(uuid, text) from anon, authenticated;
revoke all on function desfazer_ativacao(uuid)    from anon, authenticated;

grant execute on function sou_admin()              to authenticated;
grant execute on function revendas_pendentes()     to authenticated;
grant execute on function ativar_revenda(uuid, text) to authenticated;
grant execute on function desfazer_ativacao(uuid)  to authenticated;


-- ============================================================
-- FALTA UM PASSO, E ELE É MANUAL
--
-- Descubra o id da sua conta e cadastre-se como administrador.
-- Troque o e-mail pelo seu, o mesmo com que você entra no site:
--
--   insert into administradores (auth_id, nome)
--   select id, 'Igor'
--     from auth.users
--    where email = 'seu-email@exemplo.com'
--   on conflict (auth_id) do nothing;
--
-- Se a conta ainda não existir, crie uma em Authentication >
-- Users no painel do Supabase e rode o insert depois.
-- ============================================================
