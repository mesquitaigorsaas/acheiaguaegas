-- ============================================================
-- 007-estado.sql
--
-- O site vale para o Brasil inteiro. A busca não muda: ela já
-- mede a distância a partir do ponto do cliente, e o raio de
-- entrega de cada revenda decide quem atende ali.
--
-- O que muda é a revenda guardar o estado e a cidade em colunas
-- próprias. Até aqui eles só existiam escritos dentro do
-- endereço, e o administrador, com revendas do país inteiro
-- esperando ativação, precisa saber de onde cada uma é.
--
-- Rode inteiro no SQL Editor, DEPOIS do 006: a lista do
-- administrador, que o 006 cria, passa a trazer os dois.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. As colunas
--
-- Sem "not null": as revendas que já existem não têm os dois.
-- A busca não depende deles, então elas continuam aparecendo.
--
-- O estado é a sigla, numa lista fechada: a mesma do
-- js/estados.js e da função de cadastro. A cidade é texto, como
-- o CEP devolve.
-- ------------------------------------------------------------
alter table revendas
  add column if not exists uf text,
  add column if not exists cidade text;

alter table revendas drop constraint if exists uf_valida;

alter table revendas
  add constraint uf_valida check (uf in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ));

comment on column revendas.uf is 'Sigla do estado. Informativo: a busca é pela distância.';
comment on column revendas.cidade is 'Como o CEP escreveu. Informativo: a busca é pela distância.';


-- ------------------------------------------------------------
-- 2. A lista do administrador traz a cidade e o estado
--
-- O comprovante de Pix que chega no WhatsApp precisa ser casado
-- com a revenda certa — e "Gás Central" pode existir em São Paulo
-- e em Recife.
--
-- O retorno muda, então a função sai e volta, e as permissões do
-- 006 são refeitas junto.
-- ------------------------------------------------------------
drop function if exists revendas_pendentes();

create function revendas_pendentes()
returns table (
  id                    uuid,
  nome                  text,
  cnpj                  text,
  whatsapp              text,
  telefone_responsavel  text,
  endereco_texto        text,
  cidade                text,
  uf                    text,
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
           r.endereco_texto, r.cidade, r.uf, r.plano, r.assinatura_status,
           r.assinatura_vencimento, r.criado_em
      from revendas r
     where r.assinatura_status in ('aguardando_pagamento', 'suspensa')
     order by r.criado_em;
end;
$$;

revoke all on function revendas_pendentes() from anon, authenticated;
grant execute on function revendas_pendentes() to authenticated;

commit;
