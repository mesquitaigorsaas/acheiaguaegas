// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: busca.js
// Versão: 1.0
// ==========================================

/*
   A tela do cliente, em três passos na mesma página.

     1. onde você está
     2. o que você quer
     3. quem entrega aí

   O passo de baixo só aparece quando o de cima está respondido, e o
   respondido encolhe para um resumo com botão de trocar. Sem tela nova
   de propósito: endereço errado é o erro mais comum aqui, e o mais
   caro, já que decide a lista inteira. Voltar para corrigir não pode
   custar uma navegação.

   O que a pessoa respondeu fica guardado no navegador. Quem pede gás
   pede de novo do mesmo lugar, e digitar o endereço toda vez é o tipo
   de atrito que faz desinstalar.
*/

const GUARDADO = "achei-agua-gas:onde";

const estado = {
    onde: null,   // { lat, lng, escrito }
    tipo: null,   // "gas" ou "agua"
    item: null    // { id, nome, apelido }
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

    if (estado.item) procurar();
}


/* ==========================================
   PASSO 2 — O QUE VOCÊ QUER
========================================== */

function escolherTipo(tipo) {
    estado.tipo = tipo;
    estado.item = null;

    document.querySelectorAll(".tipo").forEach((b) => {
        b.classList.toggle("escolhido", b.dataset.tipo === tipo);
    });

    const doTipo = catalogo.filter((i) => i.tipo === tipo);

    document.getElementById("itens").innerHTML = doTipo.map((i) => `
        <button type="button" class="item-botao" data-item="${esc(i.id)}">${esc(i.apelido || i.nome)}</button>
    `).join("");

    // Um item só no tipo não merece pergunta: escolhe sozinho e vai
    // direto para a lista.
    if (doTipo.length === 1) escolherItem(doTipo[0].id);
}


function escolherItem(id) {
    estado.item = catalogo.find((i) => i.id === id) || null;
    if (!estado.item) return;

    document.querySelectorAll(".item-botao").forEach((b) => {
        b.classList.toggle("escolhido", b.dataset.item === id);
    });

    document.getElementById("resumo-oque").innerHTML =
        esc(estado.item.nome) + "<small>" + (estado.tipo === "gas" ? "Gás" : "Água") + "</small>";

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
    if (qual === "onde") {
        document.getElementById("passo-onde").classList.remove("pronto");
        document.getElementById("passo-onde").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }
    document.getElementById("passo-oque").classList.remove("pronto");
    document.getElementById("passo-oque").scrollIntoView({ behavior: "smooth", block: "start" });
}


/* ==========================================
   PASSO 3 — QUEM ENTREGA AÍ
========================================== */

async function procurar() {
    if (!estado.onde || !estado.item) return;

    const secao = document.getElementById("resultados");
    const lista = document.getElementById("lista");

    secao.hidden = false;
    document.getElementById("contagem").textContent = "";
    lista.innerHTML = `<div class="vazio"><p>Procurando...</p></div>`;

    try {
        const achados = await buscarRevendas(estado.onde.lat, estado.onde.lng, estado.item.id);
        desenharLista(achados);
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

    if (!achados.length) {
        contagem.textContent = "";
        lista.innerHTML = `
            <div class="vazio">
                <h3>Ninguém entrega ${esc(estado.item.apelido || estado.item.nome)} aí ainda</h3>
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

    // O selo de mais barata vale entre as ABERTAS. Apontar a mais
    // barata de todas quando ela está fechada manda a pessoa para
    // um telefone que ninguém atende.
    const menorAberta = Math.min(...achados.filter((r) => r.aberta).map((r) => Number(r.preco)));

    lista.innerHTML = achados.map((r, i) => cartao(r, i === 0, Number(r.preco) === menorAberta && r.aberta)).join("");
}


function cartao(r, primeira, maisBarata) {
    const zap = numeroDeZap(r.whatsapp);
    const texto = `Olá! Vi no Achei Água & Gás. Você entrega ${estado.item.nome} aqui?`;

    const logo = r.logo_url
        ? `<img class="logo" src="${esc(r.logo_url)}" alt="" loading="lazy">`
        : `<div class="logo logo-vazia" aria-hidden="true">${estado.tipo === "gas" ? "🔥" : "💧"}</div>`;

    return `
        <article class="revenda${primeira && r.aberta ? " melhor" : ""}${r.aberta ? "" : " fechada"}">
            ${logo}

            <div class="miolo">
                <h3>${esc(r.nome)}</h3>
                <div class="linha-selos">
                    <span class="selo ${r.aberta ? "aberta" : "fechada"}">${r.aberta ? "Aberta agora" : "Fechada"}</span>
                    ${maisBarata ? '<span class="selo mais-barata">Mais barata</span>' : ""}
                    <span>${esc(kmEscrito(r.distancia_km) || "")}</span>
                </div>
            </div>

            <div class="preco">
                ${esc(dinheiro(r.preco))}
                <small>${esc(estado.item.apelido || estado.item.nome)}</small>
            </div>

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

    document.addEventListener("click", (evento) => {
        const tipo = evento.target.closest("[data-tipo]");
        if (tipo) { escolherTipo(tipo.dataset.tipo); return; }

        const item = evento.target.closest("[data-item]");
        if (item) { escolherItem(item.dataset.item); return; }

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

    // Quem já disse onde mora não precisa dizer de novo.
    try {
        const lembrado = JSON.parse(localStorage.getItem(GUARDADO) || "null");
        if (lembrado && Number.isFinite(lembrado.lat)) definirOnde(lembrado);
    } catch (e) {
        // Nada guardado, ou guardado torto. Começa do zero.
    }
})();
