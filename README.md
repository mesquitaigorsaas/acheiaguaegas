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
| Painel da revenda | **não começou** |
| Cobrança da assinatura | **não começou** |
| Site publicado | **não começou** |

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

Depois, a função de cadastro:

```bash
npx supabase functions deploy cadastro-revenda --project-ref mqrcvemdhlyjufvwhvke --no-verify-jwt --use-api
```

O `--no-verify-jwt` é obrigatório: quem chama é visitante sem conta.

Para rodar um arquivo inteiro sem abrir o painel:

```bash
npx supabase db query --linked --project-ref mqrcvemdhlyjufvwhvke -f supabase/schema.sql
```

O `--linked` é obrigatório junto do `--project-ref`; sozinho, ele é recusado.

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

js/busca.js             os três passos da busca
js/anunciar.js          o cadastro, com CNPJ e endereço conferidos
js/banco.js             de onde vêm os dados, e o modo demonstração
js/desenhos.js          o desenho de cada botijão e galão de água, com o nome dentro
js/onde.js              GPS, CEP e nome de rua viram coordenada
js/distancia.js         a conta da distância e como ela é escrita
js/cnpj.js              o dígito verificador
js/utils.js             dinheiro, escape, WhatsApp, aberto agora

data/demo.json          seis revendas de mentira, para rodar sem banco
supabase/               estrutura, segurança, catálogo e a função de cadastro
assets/marca/           a nossa logo, longe das logos das revendas
```
