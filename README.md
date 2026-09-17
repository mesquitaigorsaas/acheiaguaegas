# Achei Água & Gás

Quem entrega água e gás perto de você, aberto agora, e por quanto.

Duas portas. O **cliente** diz onde está, marca o que quer e vê quem atende
ali. O **dono da revenda** anuncia, e define no painel o preço, o horário e
até onde entrega.

---

## A diferença para os outros projetos da casa

No Cardápio Online o cliente **já sabe** de qual comércio quer comprar: chegou
por um link que o próprio comércio mandou, e cada assinante tem o seu endereço.

Aqui é o contrário. O cliente **não sabe** de quem vai comprar, e o sistema é
que escolhe por ele. Disso vêm três coisas que lá não existiam:

- **Raio de entrega por revenda.** Quem está a oito quilômetros e entrega em
  dez atende; quem está a dois e entrega em um, não.
- **Catálogo fechado de itens.** O dono não escreve o nome do produto: marca
  numa lista nossa. Com texto livre, "P13", "botijão 13" e "gás 13 kg" seriam
  três produtos e nenhum preço seria comparável — e comparar preço é o produto.
- **A busca é uma função do banco.** A tabela de revendas *é* a carteira de
  clientes. Leitura livre nela entregaria a lista inteira de assinantes, com
  nome, telefone e endereço, a qualquer concorrente. Conferido em 11/09/2026:
  pela chave pública, `revendas` e `precos` voltam vazios.

---

## Estado atual

| Parte | Situação |
|---|---|
| Banco, regras de segurança e catálogo | no ar no Supabase |
| Busca do cliente, com distância e preço | pronta e testada contra o banco |
| Revendas de exemplo em Alfenas | no banco, para demonstrar |
| Pedido com água e gás juntos | pronto |
| Entrega ou retirada | pronto |
| Cadastro da revenda | pronto e testado |
| Painel da revenda | pronto |
| Cobrança da assinatura | Pix pelo Mercado Pago, liberação automática |
| Vencimento | tira do ar sozinho, todo dia às 00:05 |

O projeto no Supabase é `mqrcvemdhlyjufvwhvke`.

---

## Rodar no seu computador

Precisa do Node. Na pasta do projeto:

```bash
node .claude/serve.js
```

Depois abra `http://localhost:4620`.

Abrir o `index.html` com dois cliques **não funciona**: em endereços `file://`
o navegador bloqueia a leitura dos arquivos de dados.

---

## Montar o banco do zero

No SQL Editor, nesta ordem:

1. `supabase/schema.sql` — tabelas e as funções que respondem à busca
2. `supabase/policies.sql` — as regras de segurança
3. `supabase/itens.sql` — o catálogo de botijões e galões
4. `supabase/exemplo-alfenas.sql` — seis revendas de mentira, para o site ter
   o que mostrar antes do primeiro cliente. O CNPJ delas começa com 99, e é
   assim que se apaga todas de uma vez:
   ```sql
   delete from revendas where cnpj like 99%;
   ```
5. `supabase/002-logos.sql`, `supabase/003-horarios-por-dia.sql` e
   `supabase/004-taxa-e-pagamento.sql`, nesta ordem — logos, horário por
   dia e por tipo, e taxa de entrega com formas de pagamento
6. `supabase/006-admin.sql` — o painel de administração
7. `supabase/007-estado.sql` — o estado e a cidade da revenda em colunas
   próprias, e os dois na lista do administrador. **Rode antes de publicar a
   função de cadastro nova**: ela grava as duas colunas, e sem elas todo
   cadastro falha.
8. `supabase/008-p20-p90.sql`, `009-admin-completo.sql` e `010-extras.sql`,
   nesta ordem.
9. `supabase/011-pagamento-automatico.sql` — a tabela de pagamentos, a
   trava que impede o dono de mexer na própria assinatura, a situação
   "vencida" e o agendamento que tira do ar quem venceu.

Depois, as três funções:

```bash
npx supabase functions deploy cadastro-revenda --project-ref mqrcvemdhlyjufvwhvke --no-verify-jwt --use-api
npx supabase functions deploy pagar-assinatura --project-ref mqrcvemdhlyjufvwhvke --no-verify-jwt --use-api
npx supabase functions deploy webhook-mercadopago --project-ref mqrcvemdhlyjufvwhvke --no-verify-jwt --use-api
```

O `--no-verify-jwt` é obrigatório nas três. A de cadastro é chamada por
visitante sem conta; a de aviso, pelo Mercado Pago; a de pagar confere a
sessão por dentro.

Para rodar um arquivo inteiro sem abrir o painel:

```bash
npx supabase db query --linked --project-ref mqrcvemdhlyjufvwhvke -f supabase/schema.sql
```

O `--linked` é obrigatório junto do `--project-ref`; sozinho, ele é recusado.

---

## A cobrança da assinatura

Dois planos: **mensal, R$ 9,90** (vale 1 mês) e **anual, R$ 99,00** (vale
12 meses). A revenda paga por Pix, sem sair do site e sem mandar
comprovante, em três lugares: no fim do cadastro, no login de quem não pagou ou deixou vencer,
e no botão **Renovar agora** do painel.

```
pagar-assinatura            →  cria o Pix no Mercado Pago e devolve o QR Code
webhook-mercadopago         →  o Pix caiu: consulta o Mercado Pago e libera
creditar_pagamento()        →  única porta que estende o vencimento
vencer_assinaturas()        →  todo dia às 00:05, tira do ar quem venceu
```

O valor cobrado mora na função `pagar-assinatura`, e não na tela. Mudou o
preço? Mude lá **e** em `js/planos.js`, que só desenha os botões.

Cada QR Code é uma cobrança própria, amarrada à revenda e ao plano. Por isso
não existe comprovante: o Mercado Pago diz quem pagou.

Cartão ficou de fora de propósito. O modo de teste do Mercado Pago para
cartão exige contas de teste separadas, e o Pix resolve o que o dono de
revenda usa no dia a dia.

Renovar adiantado não perde dia: o prazo novo conta do vencimento atual.

Revenda **bloqueada** ou **cancelada** pelo administrador não consegue pagar:
a tela manda falar no WhatsApp. Pagar não desfaz a decisão do administrador.

Estorno e contestação ficam gravados na tabela `pagamentos`, mas não tiram a
revenda do ar sozinhos. Quem decide é o administrador.

### Ligar o Mercado Pago

1. No [painel de desenvolvedor](https://www.mercadopago.com.br/developers/panel/app),
   abra a aplicação do Achei Água & Gás (Checkout Transparente).
2. Em **Credenciais de produção**, copie o **Access Token** e grave nos
   segredos das funções. Ele é secreto: cobra em nome da conta. Nunca em
   arquivo, nunca em mensagem. O jeito mais seguro é pelo painel do
   Supabase, em **Edge Functions → Secrets**, com o nome
   `MERCADOPAGO_ACCESS_TOKEN`.
3. Em **Webhooks → Configurar notificações**, modo de produção:
   - URL: `https://mqrcvemdhlyjufvwhvke.supabase.co/functions/v1/webhook-mercadopago`
   - Evento: **Pagamentos**

   Ao salvar, o Mercado Pago mostra a **assinatura secreta**. Grave nos
   mesmos segredos com o nome `MERCADOPAGO_WEBHOOK_SECRET`.
4. Teste com um Pix de verdade, pago pelo app de **outro banco** (o Mercado
   Pago recusa a conta pagar para ela mesma). O dinheiro cai na própria
   conta, menos a tarifa do Pix.

A conta do Mercado Pago precisa ter chave Pix cadastrada.

---

## O Brasil inteiro

Não existe lista de cidades. A página abre pedindo a localização do
aparelho, e o mapa mostra o ponto e a rua que achou; a pessoa completa com o
número e a observação. Se a rua estiver errada, ou a entrega for em outro
lugar, "Entregar em outro endereço" abre o formulário com rua ou CEP. Sem
permissão de localização, o formulário já abre sozinho.

O GPS decide a lista; o endereço escrito decide a entrega. O WhatsApp não
abre sem o número.

A revenda informa o estado num select, e a cidade como o CEP escreve. Os dois
são informativos — ficam no painel e na lista do administrador. Quem decide
quem aparece para quem é a distância e o raio de entrega.

A lista dos 27 estados mora em `js/estados.js`, na função de cadastro e na
trava `uf_valida` do `007-estado.sql`.

---

## Como o cliente acha alguém

```
GPS ou endereço  →  latitude e longitude
                 →  função buscar() no Postgres
                 →  distância, preço, aberto agora
```

A distância é linha reta, por Haversine. Não conhece rua nem morro, e serve
para **ordenar**, não para prometer tempo — entre uma revenda a 800 metros e
outra a 3 km, a mais perto é a mais perto por qualquer caminho.

A coordenada sai do GPS do aparelho, ou do endereço escrito, via CEP na
BrasilAPI e nome da rua no Nominatim. Nenhum dos dois pede chave, e isso não é
economia: o site é estático, e qualquer chave dentro dele estaria à vista.

**A lista começa por quem tem o pedido inteiro, e dentro disso a mais perto.**
O cliente pode trocar para **menor preço** no topo da lista: quem escolhe entre
economizar cinco reais e esperar menos é ele. Mesmo por preço, quem tem só
parte do pedido fica atrás — o total dela é menor porque falta coisa.

---

## O que o cadastro da revenda cobra

São os campos em que um erro do anunciante vira reclamação contra o site.

- **CNPJ**, conferido pelo dígito verificador enquanto digita. Ele vai na nota
  da assinatura, e um número trocado só apareceria no dia de emitir.
- **Endereço**, com botão que mostra **o que o mapa entendeu**, e não um visto
  verde. Mexer no endereço depois descarta a coordenada já conferida — senão a
  pessoa confere um, troca a rua e salva com o ponto antigo.
- **WhatsApp dos pedidos** e **telefone do responsável**, separados. O primeiro
  fica no balcão, com quem estiver no turno; o segundo é por onde falamos de
  cobrança.

Preço, horário, raio e se entrega ficam no painel, depois de entrar. Numa tela
de trinta campos o dono desiste no meio.

---

## Arquivos

```
index.html              a busca do cliente
anunciar.html           o cadastro da revenda
entrar.html             o login, e o pagamento de quem não pagou
painel.html             o painel da revenda
admin.html              o painel do administrador

js/busca.js             os três passos da busca
js/anunciar.js          o cadastro, com CNPJ e endereço conferidos
js/planos.js            os dois planos e o WhatsApp do suporte
js/pagamento.js         a caixa de pagamento por Pix
js/banco.js             de onde vêm os dados, e o modo demonstração
js/estados.js           os 27 estados, para os selects de endereço
js/desenhos.js          o desenho de cada botijão e galão de água, com o nome dentro
js/onde.js              GPS, CEP e nome de rua viram coordenada
js/distancia.js         a conta da distância e como ela é escrita
js/cnpj.js              o dígito verificador
js/utils.js             dinheiro, escape, WhatsApp, aberto agora

data/demo.json          seis revendas de mentira, para rodar sem banco
supabase/               estrutura, segurança, catálogo e as funções de
                        cadastro, cobrança e aviso de pagamento
assets/marca/           a nossa logo, longe das logos das revendas
```
