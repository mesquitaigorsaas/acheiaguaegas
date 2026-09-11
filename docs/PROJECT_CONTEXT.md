# Achei Água & Gás — contexto do projeto

**Empresa:** Mesquita SAAS
**Começou em:** 11/09/2026
**Nome:** Achei Água & Gás, decidido em 11/09/2026. Entra na família dos
outros: Achei Vaga, Achei Músico, Achei República.

---

## A ideia

Um site só para achar quem entrega água e gás perto de você, aberto agora,
e por quanto.

Duas portas, como no Cardápio Online:

**O dono da revenda** se cadastra e anuncia. Põe a logo, o nome, o endereço,
marca os tipos que vende e o preço de cada um.

**O cliente** entra, diz onde está, escolhe o que quer, e vê a lista de quem
está perto, aberto, e quanto cobra.

---

## A diferença que muda tudo

No Cardápio Online o cliente **já sabe** em qual comércio vai comprar: ele
chegou por um link que o próprio comércio mandou. Cada assinante tem o seu
endereço e nunca disputa com o vizinho.

Aqui é o contrário. O cliente **não sabe** de quem vai comprar, e o sistema é
que escolhe por ele. Isso muda três coisas:

- **Um endereço só.** Não existe `site.com.br/revendadoze`. Existe uma busca.
- **Os assinantes disputam entre si.** Quem aparece em primeiro lugar vale
  dinheiro, e a ordem precisa ter um critério que o dono entenda e aceite.
- **O valor para o dono não é ter um site.** É aparecer para quem já está
  procurando. Isso muda o discurso de venda e, provavelmente, o preço.

---

## O que precisa ficar decidido antes de programar

### 1. Como medir "mais próximo" — DECIDIDO em 11/09/2026

**Distância de verdade, em quilômetros.** O cliente toca num botão e o
celular diz onde ele está; o dono marca a revenda num mapa no cadastro.

Descartamos a lista de bairros porque ela não separa quem está a três
quarteirões de quem está a quatro quilômetros — e num pedido de gás, que a
pessoa quer para hoje, essa é justamente a diferença que importa.

Duas consequências que vêm junto:

- **Raio de entrega por revenda.** Não basta estar perto: quem está a oito
  quilômetros e entrega em dez atende; quem está a dois e entrega em um, não.
  Sem isso a lista mostra gente que vai recusar o pedido, e a culpa fica com
  o site.
- **Catálogo fechado de itens.** Se cada revenda escrever o nome do produto
  do seu jeito, "P13", "botijão 13", "gás 13 kg" viram três coisas
  diferentes e nenhum preço é comparável. Comparar preço é o produto
  inteiro, então o nome do item é nosso, não do anunciante.

### 2. Como o pedido chega

O molde da casa é WhatsApp: o cliente clica e a conversa abre com o pedido
escrito. Aqui provavelmente é o mesmo, e o sistema não intermedia o dinheiro.

## O que o cadastro da revenda TEM de exigir

Decidido em 11/09/2026, depois de a busca ficar pronta. São os campos em que
um erro do anunciante vira reclamação contra o site, e não contra ele.

**Entrega, retirada, ou os dois.** Nem toda revenda entrega; muita gente vende
só no balcão. Sem esta pergunta o site manda alguém esperar em casa uma
entrega que nunca vem. O contrário também: quem só entrega e não atende no
balcão precisa dizer, senão o cliente pega o carro à toa.

**O horário, de verdade.** É o que decide se ela aparece na lista, porque o
filtro de "aberto agora" vem ligado — água e gás é necessidade, e quem procura
quer agora. Horário errado tem dois custos, e os dois são dela: cadastrado a
menos, ela some da busca no melhor horário; cadastrado a mais, o cliente liga e
não é atendido, e a próxima busca ele faz em outro lugar.

**O raio de entrega, com honestidade.** É a promessa que ela faz. Fora dele
ela não aparece, e dentro dele ela vai ter de atender. Raio inflado para
aparecer mais é pedido recusado, e pedido recusado é o cliente saindo do site.

**O preço em dia.** Preço velho é reclamação na certa, e aqui a comparação é o
produto inteiro. O painel guarda quando cada preço foi mexido pela última vez,
justamente para a gente poder cobrar quem esqueceu.

A tela de cadastro precisa dizer isso em português, e não esconder atrás de um
campo qualquer. O dono não está tentando enganar ninguém: ele está com pressa e
não imagina o que cada campo faz na busca.

### 3. Quem paga, e por quê

No Cardápio Online o dono paga pelo site. Aqui ele paga por aparecer. Pode
ser assinatura, pode ser anúncio destacado, pode ser grátis para entrar e
pago para subir na lista.

### 4. O problema do primeiro dia

Um site de busca sem revendas cadastradas não serve ao cliente, e sem
clientes não atrai revendas. Alguém tem de vir primeiro, e isso é decisão de
negócio, não de código.

---

## O molde técnico

O mesmo que já está provado no Cardápio Online, e que vale herdar:

- HTML, CSS e JavaScript puro. Sem framework, sem build.
- Supabase para banco, login e arquivos.
- Um assinante por linha na tabela principal, com RLS separando um do outro.
- Publicação no Cloudflare, com `.claude/publicar.js` levando só o que pode
  ir para a internet.
- Cadastro e cobrança por Edge Function, com webhook do Mercado Pago
  confirmando o pagamento sozinho.

O que **não** se herda é o endereço por assinante: aqui o caminho da URL não
nomeia comércio nenhum.

---

## Padrão de código

O mesmo dos outros projetos da casa:

- Indentação de 4 espaços
- Aspas duplas no JavaScript, ponto e vírgula sempre
- Nomes em português, do jeito que o negócio fala
- Comentário explica **por que**, não o que a linha faz
- Todo texto vindo do banco passa por `esc()` antes de virar HTML
