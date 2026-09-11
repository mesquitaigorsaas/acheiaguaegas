-- ============================================================
-- ACHEI ÁGUA & GÁS — REGRAS DE SEGURANÇA (RLS)
--
-- Rode DEPOIS do schema.sql.
--
-- A regra que organiza tudo aqui é diferente da do Cardápio
-- Online, e a diferença é o produto:
--
--   Lá, cada comércio tem o seu endereço e o cardápio dele é
--   público. Ler a tabela toda não fazia mal ao cliente, só
--   expunha a carteira de assinantes.
--
--   Aqui existe UMA busca, e a tabela de revendas É a carteira
--   de clientes. Leitura livre nela seria entregar a lista
--   inteira de assinantes, com nome, telefone e endereço, a
--   qualquer concorrente que abrisse o console do navegador.
--
-- Por isso o visitante NÃO LÊ NENHUMA TABELA de revenda. Ele
-- chama a função `buscar`, que devolve só o que cabe numa tela
-- e só para quem disse onde está.
--
-- O dono logado lê e escreve a revenda DELE, e mais nada.
-- ============================================================


-- ------------------------------------------------------------
-- Qual revenda é a minha
--
-- `security definer` para poder ler `usuarios` sem cair na
-- própria política que está sendo escrita — sem isso a regra
-- consultaria a si mesma e o Postgres entra em recursão.
-- ------------------------------------------------------------
create or replace function minha_revenda()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.revenda_id
    from usuarios u
   where u.auth_id = auth.uid()
     and u.ativo
   limit 1;
$$;


-- ============================================================
-- REVENDAS
-- ============================================================

alter table revendas enable row level security;

-- Nenhuma política de leitura para o visitante, e isso é a
-- decisão, não um esquecimento: quem não está logado enxerga
-- revenda só pela função `buscar`.

create policy "o dono lê a revenda dele"
  on revendas for select
  to authenticated
  using (id = minha_revenda());

create policy "o dono edita a revenda dele"
  on revendas for update
  to authenticated
  using (id = minha_revenda())
  with check (id = minha_revenda());

-- Ninguém cria nem apaga revenda pelo navegador. Criar é da
-- Edge Function de cadastro, com a chave de serviço; apagar é
-- do suporte, pelo SQL, e de propósito: conta apagada por
-- engano não volta.


-- ============================================================
-- ITENS — o catálogo
-- ============================================================

alter table itens enable row level security;

-- Este é o único que o visitante lê direto, e precisa ler: é
-- com ele que a tela monta os botões de P13, galão de 20 litros
-- e o resto. Não tem nada de ninguém dentro.
create policy "todo mundo lê o catálogo"
  on itens for select
  to anon, authenticated
  using (ativo);

-- Item novo entra por SQL nosso. O dono da revenda marca o que
-- vende; não inventa produto.


-- ============================================================
-- PREÇOS
-- ============================================================

alter table precos enable row level security;

-- Sem leitura para o visitante: preço sai pela função `buscar`,
-- junto da revenda. Solto, ele seria a tabela de preços de
-- todos os assinantes, baixável de uma vez — que é exatamente o
-- que um concorrente quer.

create policy "o dono lê os preços dele"
  on precos for select
  to authenticated
  using (revenda_id = minha_revenda());

create policy "o dono cria preço na revenda dele"
  on precos for insert
  to authenticated
  with check (revenda_id = minha_revenda());

create policy "o dono edita o preço dele"
  on precos for update
  to authenticated
  using (revenda_id = minha_revenda())
  with check (revenda_id = minha_revenda());

create policy "o dono apaga o preço dele"
  on precos for delete
  to authenticated
  using (revenda_id = minha_revenda());


-- ============================================================
-- HORÁRIOS
-- ============================================================

alter table horarios enable row level security;

-- O visitante não lê: quem responde se está aberta é a função
-- `esta_aberta`, que roda com direitos próprios dentro do
-- banco. A tela recebe sim ou não, e não a agenda da revenda.

create policy "o dono lê os horários dele"
  on horarios for select
  to authenticated
  using (revenda_id = minha_revenda());

create policy "o dono cria horário na revenda dele"
  on horarios for insert
  to authenticated
  with check (revenda_id = minha_revenda());

create policy "o dono edita o horário dele"
  on horarios for update
  to authenticated
  using (revenda_id = minha_revenda())
  with check (revenda_id = minha_revenda());

create policy "o dono apaga o horário dele"
  on horarios for delete
  to authenticated
  using (revenda_id = minha_revenda());


-- ============================================================
-- USUARIOS
-- ============================================================

alter table usuarios enable row level security;

-- Cada um enxerga a própria linha. Ler os usuários da revenda
-- inteira só fará sentido quando existir mais de um por conta,
-- e aí a regra muda junto com a tela que precisa disso.
create policy "vejo a minha própria conta"
  on usuarios for select
  to authenticated
  using (auth_id = auth.uid());


-- ============================================================
-- QUEM PODE CHAMAR AS FUNÇÕES
-- ============================================================

-- A busca é pública: é a porta da frente do site.
grant execute on function buscar(numeric, numeric, uuid[], text, numeric) to anon, authenticated;

-- As duas de apoio são chamadas de dentro da busca, mas deixar
-- o visitante chamá-las direto não abre nada: uma devolve um
-- booleano, a outra uma conta de trigonometria.
grant execute on function distancia_km(numeric, numeric, numeric, numeric) to anon, authenticated;
grant execute on function esta_aberta(uuid) to anon, authenticated;
grant execute on function revenda_no_ar(uuid) to anon, authenticated;

grant execute on function minha_revenda() to authenticated;
