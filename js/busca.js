// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: busca.js
// Versão: 2.0
// ==========================================

/*
   A tela do cliente, em três passos na mesma página.

     1. onde você está
     2. o que você quer — um item ou vários
     3. quem entrega aí

   O passo de baixo só aparece quando o de cima está respondido, e o
   respondido encolhe para um resumo com botão de trocar. Sem tela nova
   de propósito: endereço errado é o erro mais comum aqui, e o mais
   caro, já que decide a lista inteira. Voltar para corrigir não pode
   custar uma navegação.

   O PEDIDO É UMA LISTA, e não um item só. Quem está com o botijão
   vazio muitas vezes está com o galão vazio também, e comprar os dois
   na mesma revenda é uma entrega em vez de duas. Marca o gás, marca a
   água, e fecha o pedido.

   O que a pessoa respondeu fica guardado no navegador. Quem pede gás
   pede de novo do mesmo lugar, e digitar o endereço toda vez é o tipo
   de atrito que faz desinstalar.
*/

const GUARDADO = "achei-agua-gas:onde";

const estado = {
    onde: null,   // { lat, lng, escrito }
    tipo: "gas",  // a aba aberta: "gas" ou "agua"
    pedido: []    // os itens marcados, na ordem em que foram marcados
};

let catalogo = [];


/* ==========================================
   RECADOS
========================================== */

function avisar(texto, tipo) {
    const recado = document.getElementById("recado");
    recado.textContent = texto || "";
    recado.className = "recado" + (tipo === "erro" ? " erro" : "");
    recado.hidden = !texto;
    if (texto) recado.scrollIntoView({ behavior: "smooth", block: "nearest" });
}


/* ==========================================
   PASSO 1 — ONDE VOCÊ ESTÁ
========================================== */

async function usarGps() {
    const botao = document.getElementById("botao-gps");
    botao.disabled = true;
    botao.textContent = "Procurando você...";
    avisar("");

    try {
        const p = await ondeEstouPeloAparelho();
        definirOnde({ lat: p.lat, lng: p.lng, escrito: "Sua localização agora" });
    } catch (erro) {
        avisar(erro.message, "erro");
    }

    botao.disabled = false;
    botao.textContent = "Usar a minha localização";
}


async function usarEndereco(evento) {
    evento.preventDefault();

    const rua = document.getElementById("rua").value.trim();
    const cidade = document.getElementById("cidade").value.trim();

    if (!rua) {
        avisar("Escreva a rua, ou use o CEP no lugar dela.", "erro");
        return;
    }

    const botao = evento.target.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Procurando...";
    avisar("");

    // Só dígitos e oito deles: é CEP, e não nome de rua.
    const talvezCep = rua.replace(/\D/g, "");
    const achado = await ondeFica({
        cep: talvezCep.length === 8 ? talvezCep : null,
        rua: talvezCep.length === 8 ? null : rua,
        cidade,
        uf: "MG"
    });

    botao.disabled = false;
    botao.textContent = "Achar este endereço";

    if (!achado) {
        avisar("Não achei esse endereço. Confira a rua e a cidade, ou use o botão de localização.", "erro");
        return;
    }

    definirOnde({
        lat: achado.lat,
        lng: achado.lng,
        escrito: [rua, cidade].filter(Boolean).join(", ")
    });
}


function definirOnde(onde) {
    estado.onde = onde;

    try {
        localStorage.setItem(GUARDADO, JSON.stringify(onde));
    } catch (e) {
        // Navegador anônimo, ou site bloqueado de guardar. A busca
        // funciona igual; só não lembra na próxima visita.
    }

    document.getElementById("resumo-onde").innerHTML =
        "Buscando perto de<small>" + esc(onde.escrito) + "</small>";

    fecharPasso("passo-onde");
    document.getElementById("passo-oque").hidden = false;

    if (estado.pedido.length) procurar();
}


/* ==========================================
   PASSO 2 — O QUE VOCÊ QUER
========================================== */

/**
 * Troca a aba entre gás e água. NÃO limpa o que já foi marcado: é
 * justamente para poder pedir os dois que as duas abas existem.
 */
function abrirTipo(tipo) {
    estado.tipo = tipo;

    document.querySelectorAll(".tipo").forEach((b) => {
        b.classList.toggle("escolhido", b.dataset.tipo === tipo);
    });

    document.getElementById("itens").innerHTML = catalogo
        .filter((i) => i.tipo === tipo)
        .map((i) => `
            <button type="button" class="item-botao${noPedido(i.id) ? " escolhido" : ""}" data-item="${esc(i.id)}">
                ${esc(i.apelido || i.nome)}
            </button>
        `).join("");
}


function noPedido(id) {
    return estado.pedido.some((i) => i.id === id);
}


/** Marca ou desmarca. Clicar de novo no que já está no pedido tira. */
function alternarItem(id) {
    const item = catalogo.find((i) => i.id === id);
    if (!item) return;

    if (noPedido(id)) {
        estado.pedido = estado.pedido.filter((i) => i.id !== id);
    } else {
        estado.pedido.push(item);
    }

    abrirTipo(estado.tipo);
    desenharPedido();
}


function desenharPedido() {
    const caixa = document.getElementById("meu-pedido");
    const botao = document.getElementById("botao-fechar-pedido");

    if (!estado.pedido.length) {
        caixa.hidden = true;
        botao.hidden = true;
        return;
    }

    caixa.hidden = false;
    botao.hidden = false;

    caixa.innerHTML = "<span class='rotulo-pedido'>Seu pedido</span>"
        + estado.pedido.map((i) => `
            <button type="button" class="ficha" data-tirar="${esc(i.id)}"
                    title="Tirar do pedido">
                ${esc(i.apelido || i.nome)} <span aria-hidden="true">&times;</span>
            </button>
        `).join("");

    botao.textContent = estado.pedido.length === 1
        ? "Ver quem entrega"
        : "Fechar pedido e ver quem entrega";
}


function fecharPedido() {
    if (!estado.pedido.length) return;

    document.getElementById("resumo-oque").innerHTML =
        esc(estado.pedido.map((i) => i.apelido || i.nome).join(" + "))
        + "<small>" + estado.pedido.length + (estado.pedido.length === 1 ? " item" : " itens") + "</small>";

    fecharPasso("passo-oque");
    procurar();
}


/* ==========================================
   OS PASSOS ABRINDO E FECHANDO
========================================== */

function fecharPasso(id) {
    document.getElementById(id).classList.add("pronto");
}

function abrirPasso(qual) {
    const id = qual === "onde" ? "passo-onde" : "passo-oque";
    document.getElementById(id).classList.remove("pronto");
    document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "start" });
}


/* ==========================================
   PASSO 3 — QUEM ENTREGA AÍ
========================================== */

async function procurar() {
    if (!estado.onde || !estado.pedido.length) return;

    const secao = document.getElementById("resultados");
    const lista = document.getElementById("lista");

    secao.hidden = false;
    document.getElementById("contagem").textContent = "";
    lista.innerHTML = `<div class="vazio"><p>Procurando...</p></div>`;

    try {
        const ids = estado.pedido.map((i) => i.id);
        desenharLista(await buscarRevendas(estado.onde.lat, estado.onde.lng, ids));
    } catch (erro) {
        console.error("Erro na busca:", erro);
        lista.innerHTML = `
            <div class="vazio">
                <h3>Não consegui buscar agora</h3>
                <p>Tente de novo em alguns segundos.</p>
            </div>`;
    }
}


function desenharLista(achados) {
    const lista = document.getElementById("lista");
    const contagem = document.getElementById("contagem");
    const pedidos = estado.pedido.length;

    if (!achados.length) {
        contagem.textContent = "";
        lista.innerHTML = `
            <div class="vazio">
                <h3>Ninguém entrega isso aí ainda</h3>
                <p>
                    O site é novo e as revendas estão entrando aos poucos.
                    Se você conhece uma que entrega no seu endereço, indique
                    para ela anunciar — passa a aparecer para o bairro inteiro.
                </p>
            </div>`;
        return;
    }

    const abertas = achados.filter((r) => r.aberta).length;
    contagem.textContent = achados.length === 1
        ? "1 revenda"
        : achados.length + " revendas, " + abertas + " abertas agora";

    // O selo de mais barata vale entre as que estão ABERTAS e têm o
    // pedido INTEIRO. Apontar a mais barata de todas quando ela está
    // fechada manda a pessoa para um telefone que ninguém atende; e
    // apontar quem só tem metade compara preços de coisas diferentes.
    const completasAbertas = achados.filter((r) => r.aberta && r.itens_encontrados === pedidos);
    const menorTotal = completasAbertas.length
        ? Math.min(...completasAbertas.map((r) => Number(r.total)))
        : null;

    lista.innerHTML = achados
        .map((r) => cartao(r, pedidos, menorTotal))
        .join("");
}


function cartao(r, pedidos, menorTotal) {
    const completa = r.itens_encontrados === pedidos;
    const maisBarata = completa && r.aberta && Number(r.total) === menorTotal;

    const zap = numeroDeZap(r.whatsapp);

    // Os itens que ELA tem, e não os que a pessoa pediu: mandar no
    // WhatsApp um item que a revenda não vende começa a conversa com
    // uma recusa.
    const temEstes = estado.pedido.filter((i) => r.precos && r.precos[i.id] !== undefined);
    const texto = "Olá! Vi no Achei Água & Gás. Você entrega "
        + temEstes.map((i) => i.nome).join(" e ") + " aqui?";

    const logo = r.logo_url
        ? `<img class="logo" src="${esc(r.logo_url)}" alt="" loading="lazy">`
        : `<div class="logo logo-vazia" aria-hidden="true">${estado.pedido.some((i) => i.tipo === "gas") ? "🔥" : "💧"}</div>`;

    // Com um item só, o detalhamento repetiria o total logo ao lado.
    const detalhe = pedidos > 1
        ? `<ul class="detalhe-itens">` + estado.pedido.map((i) => {
            const p = r.precos ? r.precos[i.id] : undefined;
            return p === undefined
                ? `<li class="falta">${esc(i.apelido || i.nome)}<span>não vende</span></li>`
                : `<li>${esc(i.apelido || i.nome)}<span>${esc(dinheiro(p))}</span></li>`;
          }).join("") + `</ul>`
        : "";

    return `
        <article class="revenda${maisBarata ? " melhor" : ""}${r.aberta ? "" : " fechada"}">
            ${logo}

            <div class="miolo">
                <h3>${esc(r.nome)}</h3>
                <div class="linha-selos">
                    <span class="selo ${r.aberta ? "aberta" : "fechada"}">${r.aberta ? "Aberta agora" : "Fechada"}</span>
                    ${maisBarata ? '<span class="selo mais-barata">Mais barata</span>' : ""}
                    ${completa ? "" : `<span class="selo incompleta">Tem ${r.itens_encontrados} de ${pedidos}</span>`}
                    <span>${esc(kmEscrito(r.distancia_km) || "")}</span>
                </div>
            </div>

            <div class="preco">
                ${esc(dinheiro(r.total))}
                <small>${pedidos > 1 ? "total" : esc(estado.pedido[0].apelido || estado.pedido[0].nome)}</small>
            </div>

            ${detalhe}

            <div class="acao-revenda">
                <a class="botao botao-zap" href="https://wa.me/${esc(zap)}?text=${encodeURIComponent(texto)}"
                   target="_blank" rel="noopener">
                    Pedir no WhatsApp
                </a>
            </div>
        </article>
    `;
}


/* ==========================================
   LIGAR A TELA
========================================== */

(async function iniciar() {
    document.getElementById("botao-gps").addEventListener("click", usarGps);
    document.getElementById("form-endereco").addEventListener("submit", usarEndereco);
    document.getElementById("botao-fechar-pedido").addEventListener("click", fecharPedido);

    document.addEventListener("click", (evento) => {
        const tipo = evento.target.closest("[data-tipo]");
        if (tipo) { abrirTipo(tipo.dataset.tipo); return; }

        const item = evento.target.closest("[data-item]");
        if (item) { alternarItem(item.dataset.item); return; }

        const tirar = evento.target.closest("[data-tirar]");
        if (tirar) { alternarItem(tirar.dataset.tirar); return; }

        const voltar = evento.target.closest("[data-voltar]");
        if (voltar) abrirPasso(voltar.dataset.voltar);
    });

    try {
        catalogo = await carregarCatalogo();
    } catch (erro) {
        console.error("Erro ao carregar o catálogo:", erro);
        avisar("Não consegui carregar a lista de produtos. Recarregue a página.", "erro");
        return;
    }

    abrirTipo("gas");

    // Quem já disse onde mora não precisa dizer de novo.
    try {
        const lembrado = JSON.parse(localStorage.getItem(GUARDADO) || "null");
        if (lembrado && Number.isFinite(lembrado.lat)) definirOnde(lembrado);
    } catch (e) {
        // Nada guardado, ou guardado torto. Começa do zero.
    }
})();
