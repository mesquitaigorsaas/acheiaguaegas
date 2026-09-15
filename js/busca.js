// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: busca.js
// Versão: 2.0
// ==========================================

/*
   A tela do cliente, em dois passos e uma lista que se refaz sozinha.

     1. onde você está
     2. o que você quer — e a lista já aparece embaixo

   NÃO EXISTE BOTÃO DE CONFIRMAR. Quem já disse onde está e marcou o
   botijão respondeu tudo o que a busca precisa; pedir mais um clique
   para "fechar o pedido" é cobrar um passo que não decide nada. Marcar
   outro item, ou trocar entre entregar e buscar, refaz a lista na hora.

   Os dois passos ficam abertos. O do endereço não encolhe depois de
   achado: com o CEP a rua se preenche e o mapa já aparece, mas o
   número e o complemento a pessoa ainda vai escrever — sumir com os
   campos nessa hora era tirar da mão dela o que estava digitando.

   Sem tela nova de propósito: endereço errado é o erro mais comum aqui,
   e o mais caro, já que decide a lista inteira. Voltar para corrigir
   não pode custar uma navegação.

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
    onde: null,       // { lat, lng, escrito }
    tipo: "gas",      // a aba aberta: "gas" ou "agua"
    pedido: [],       // os itens marcados, na ordem em que foram marcados
    modo: "entrega",  // "entrega" ou "retirada"
    ordem: "distancia", // "distancia" ou "preco"
    // Vem DESMARCADO: a lista mostra todo mundo, e o horário é
    // informação, não corte. Quem quiser ver só quem atende agora
    // marca a caixa.
    soAbertas: false
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
        definirOnde({ lat: p.lat, lng: p.lng, escrito: "Sua localização agora", como: "gps" });
    } catch (erro) {
        avisar(erro.message, "erro");
    }

    botao.disabled = false;
    botao.textContent = "Usar a minha localização";
}


const CAMPOS = ["rua", "numero", "complemento", "bairro", "cidade", "uf"];

function lerCampos() {
    const campos = {};
    CAMPOS.forEach((id) => { campos[id] = document.getElementById(id).value.trim(); });
    return campos;
}

function preencherCampos(campos) {
    CAMPOS.forEach((id) => {
        if (campos[id] !== undefined) document.getElementById(id).value = campos[id];
    });
}

/** "Rua X, 120, apto 302 - Centro, Alfenas/MG". */
function enderecoEscrito(c) {
    const cidade = [c.cidade, c.uf].filter(Boolean).join("/");

    return [c.rua, c.numero, c.complemento].filter(Boolean).join(", ")
        + (c.bairro ? " - " + c.bairro : "")
        + (cidade ? ", " + cidade : "");
}

/** O campo inteiro é CEP, e não nome de rua: "Rua 10" tem dígito e não é. */
function cepNoCampo(texto) {
    const so = texto.replace(/\D/g, "");
    return so.length === 8 && /^[\d\s.-]+$/.test(texto.trim()) ? so : null;
}


/*
   O CEP de que veio a rua que está no campo. Sai quando a pessoa mexe
   na rua: com a rua trocada à mão, a coordenada do CEP antigo mediria
   a distância do lugar errado.
*/
let cepDaRua = null;
let cepProcurado = null;

async function aoDigitarRua() {
    const campoRua = document.getElementById("rua");
    const cep = cepNoCampo(campoRua.value);

    cepDaRua = null;
    if (!cep) { cepProcurado = null; return; }
    if (cep === cepProcurado) return;
    cepProcurado = cep;

    campoRua.classList.add("buscando");
    const achado = await enderecoDoCep(cep);
    campoRua.classList.remove("buscando");

    // A pessoa continuou digitando enquanto o CEP ia e voltava.
    if (cepNoCampo(campoRua.value) !== cep) return;

    if (!achado) {
        cepProcurado = null;
        avisar("Não achei esse CEP. Confira os números, ou escreva o nome da rua.", "erro");
        return;
    }

    avisar("");
    campoRua.value = achado.rua;
    preencherCampos({ bairro: achado.bairro, cidade: achado.cidade, uf: achado.uf });
    cepDaRua = cep;

    if (!achado.rua) {
        avisar("Esse CEP é da cidade inteira. Escreva o nome da rua.");
        campoRua.focus();
        return;
    }

    // A rua veio; o que falta é com a pessoa. O mapa já aparece
    // enquanto ela digita o número.
    document.getElementById("numero").focus();
    usarEndereco();
}


async function usarEndereco(evento) {
    if (evento) evento.preventDefault();

    const campos = lerCampos();

    if (!campos.rua) {
        avisar("Escreva a rua, ou use o CEP no lugar dela.", "erro");
        return;
    }

    const botao = document.querySelector("#form-endereco button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Procurando...";
    avisar("");

    const cepDigitado = cepNoCampo(campos.rua);
    const achado = await ondeFica({
        cep: cepDigitado || cepDaRua,
        rua: cepDigitado ? null : campos.rua,
        cidade: campos.cidade,
        uf: campos.uf || null
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
        escrito: enderecoEscrito(campos),
        como: "endereco",
        campos
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

    const resumo = document.getElementById("resumo-onde");
    resumo.innerHTML = "Buscando perto de<small>" + esc(onde.escrito) + "</small>";
    resumo.hidden = false;

    desenharMapa(onde);
    document.getElementById("passo-oque").hidden = false;

    if (estado.pedido.length) procurarLogo();
}


/**
 * O ponto da busca no Google Maps.
 *
 * Pelo endereço de incorporar, e não pela API: esse não pede chave, e
 * o site é estático — chave nenhuma ficaria escondida aqui dentro.
 */
function desenharMapa(onde) {
    const mapa = document.getElementById("mapa-onde");
    const ponto = Number(onde.lat).toFixed(6) + "," + Number(onde.lng).toFixed(6);

    // Trocar o item do pedido não mexe no lugar; recarregar o mapa
    // à toa só piscaria a tela.
    if (mapa.dataset.ponto === ponto) return;
    mapa.dataset.ponto = ponto;

    mapa.innerHTML =
        `<iframe src="https://maps.google.com/maps?q=${ponto}&z=16&output=embed"
                 title="Onde você está, no mapa" loading="lazy"></iframe>
         <a href="https://www.google.com/maps/search/?api=1&query=${ponto}"
            target="_blank" rel="noopener">Abrir no Google Maps</a>`;
    mapa.hidden = false;
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

    const itens = document.getElementById("itens");
    itens.classList.add("itens-desenho");

    itens.innerHTML = catalogo
        .filter((i) => i.tipo === tipo)
        .map((i) => {
            const escolhido = noPedido(i.id) ? " escolhido" : "";
            const desenho = desenhoDoItem(i);

            if (!desenho) {
                return `
                    <button type="button" class="item-botao${escolhido}" data-item="${esc(i.id)}">
                        ${esc(i.apelido || i.nome)}
                    </button>`;
            }

            // data-familia, e não data-tipo: data-tipo já é o clique que
            // troca a aba entre gás e água.
            return `
                <button type="button" class="item-botao item-desenho${escolhido}" data-item="${esc(i.id)}"
                        data-familia="${esc(i.tipo)}" aria-pressed="${escolhido ? "true" : "false"}"
                        aria-label="${esc(i.nome)}, ${esc(desenho.popular)}">
                    ${desenho.svg}
                    <span class="item-popular">${esc(desenho.popular)}</span>
                    <span class="item-medida">${esc(desenho.medida)}</span>
                </button>`;
        }).join("");
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

    // Sem item nenhum não há o que listar. Esconder é melhor que
    // deixar a lista anterior na tela: ela responderia a uma pergunta
    // que a pessoa acabou de desfazer.
    if (!estado.pedido.length) {
        document.getElementById("resultados").hidden = true;
        return;
    }

    procurarLogo();
}


/*
   Espera um instante antes de ir ao banco.

   Quem quer gás e água toca nos dois botões em seguida, e sem esta
   pausa a primeira busca sai com um item só, some, e é substituída
   pela segunda — a lista pisca e mostra por um segundo uma resposta
   que já está errada.
*/
let esperando = null;

function procurarLogo() {
    clearTimeout(esperando);
    esperando = setTimeout(procurar, 250);
}


function desenharPedido() {
    const caixa = document.getElementById("meu-pedido");

    if (!estado.pedido.length) {
        caixa.hidden = true;
        return;
    }

    caixa.hidden = false;

    caixa.innerHTML = "<span class='rotulo-pedido'>Seu pedido</span>"
        + estado.pedido.map((i) => `
            <button type="button" class="ficha" data-tirar="${esc(i.id)}"
                    title="Tirar do pedido">
                ${esc(i.apelido || i.nome)} <span aria-hidden="true">&times;</span>
            </button>
        `).join("")
        // Com dois itens ou mais, tirar um por um já é trabalho.
        + (estado.pedido.length > 1
            ? `<button type="button" class="limpar-pedido" data-limpar-pedido>Limpar tudo</button>`
            : "");

}


/**
 * Entregar ou buscar. Refaz a busca, e não filtra o que já veio: quem
 * só atende no balcão nem foi trazida na busca de entrega, e o raio de
 * entrega deixa de valer quando a pessoa vai de carro.
 */
function escolherModo(modo) {
    estado.modo = modo;

    document.querySelectorAll(".modo[data-modo]").forEach((b) => {
        b.classList.toggle("escolhido", b.dataset.modo === modo);
    });

    document.getElementById("titulo-resultados").textContent =
        modo === "retirada" ? "Onde buscar" : "Quem entrega aí";

    if (estado.onde && estado.pedido.length) procurar();
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

    const primeiraVez = secao.dataset.jaApareceu !== "sim";

    try {
        const ids = estado.pedido.map((i) => i.id);
        achadosDaVez = await buscarRevendas(estado.onde.lat, estado.onde.lng, ids, estado.modo);
        desenharLista();

        // Rola até a lista só na PRIMEIRA vez. Depois disso a pessoa
        // está marcando outros itens, e puxar a tela a cada toque tira
        // de debaixo do dedo o botão que ela ia apertar.
        if (primeiraVez) {
            secao.dataset.jaApareceu = "sim";
            secao.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    } catch (erro) {
        console.error("Erro na busca:", erro);
        lista.innerHTML = `
            <div class="vazio">
                <h3>Não consegui buscar agora</h3>
                <p>Tente de novo em alguns segundos.</p>
            </div>`;
    }
}


/*
   A busca vai ao banco uma vez; o "só abertas" filtra o que já veio.
   Ir de novo a cada clique numa caixinha faria a lista piscar sem
   motivo, e no celular do bairro isso custa segundos.
*/
let achadosDaVez = [];

function desenharLista() {
    const lista = document.getElementById("lista");
    const contagem = document.getElementById("contagem");
    const pedidos = estado.pedido.length;

    const fechadas = achadosDaVez.filter((r) => !r.aberta).length;
    const achados = estado.soAbertas ? achadosDaVez.filter((r) => r.aberta) : achadosDaVez;

    if (!achados.length) {
        contagem.textContent = "";

        // Vazio por causa do filtro é outra conversa: a pessoa precisa
        // saber que existe gente, só que fechada agora.
        if (fechadas && estado.soAbertas) {
            lista.innerHTML = `
                <div class="vazio">
                    <h3>Ninguém está aberto agora</h3>
                    <p>
                        ${fechadas === 1 ? "Uma revenda atende" : fechadas + " revendas atendem"}
                        aí, mas ${fechadas === 1 ? "está fechada" : "estão fechadas"} neste
                        momento. Desmarque a caixa acima para ver os preços e
                        decidir o dia de amanhã.
                    </p>
                </div>`;
            return;
        }

        lista.innerHTML = `
            <div class="vazio">
                <h3>Ninguém ${estado.modo === "retirada" ? "vende" : "entrega"} isso aí ainda</h3>
                <p>
                    O site é novo e as revendas estão entrando aos poucos.
                    Se você conhece uma que atende perto de você, indique
                    para ela anunciar — passa a aparecer para o bairro inteiro.
                </p>
            </div>`;
        return;
    }

    contagem.textContent = achados.length === 1 ? "1 revenda" : achados.length + " revendas";

    // O selo de mais barata vale entre as que estão ABERTAS e têm o
    // pedido INTEIRO. Apontar a mais barata de todas quando ela está
    // fechada manda a pessoa para um telefone que ninguém atende; e
    // apontar quem só tem metade compara preços de coisas diferentes.
    const completasAbertas = achados.filter((r) => r.aberta && r.itens_encontrados === pedidos);
    const menorTotal = completasAbertas.length
        ? Math.min(...completasAbertas.map((r) => Number(r.total)))
        : null;

    lista.innerHTML = ordenar(achados, pedidos)
        .map((r) => cartao(r, pedidos, menorTotal))
        .join("");
}


/**
 * A lista na ordem que a pessoa escolheu.
 *
 * O banco já devolve na ordem da distância: quem tem o pedido inteiro
 * primeiro, e dentro disso a mais perto. Por preço, quem tem o pedido
 * inteiro continua na frente — o total de quem só tem metade é barato
 * justamente porque falta coisa, e subir com ela seria comparar pedidos
 * diferentes. Essas ficam atrás, na ordem da distância.
 *
 * O sort do JavaScript é estável: preço empatado mantém a mais perto
 * na frente, sem precisar dizer.
 */
function ordenar(achados, pedidos) {
    if (estado.ordem !== "preco") return achados;

    return [...achados].sort((a, b) => {
        const aCompleta = a.itens_encontrados === pedidos;
        const bCompleta = b.itens_encontrados === pedidos;

        if (aCompleta !== bCompleta) return aCompleta ? -1 : 1;
        if (!aCompleta) return 0;

        return Number(a.total) - Number(b.total);
    });
}


function escolherOrdem(ordem) {
    estado.ordem = ordem;

    document.querySelectorAll("[data-ordem]").forEach((b) => {
        b.classList.toggle("escolhido", b.dataset.ordem === ordem);
    });

    desenharLista();
}


function cartao(r, pedidos, menorTotal) {
    const completa = r.itens_encontrados === pedidos;
    const maisBarata = completa && r.aberta && Number(r.total) === menorTotal;

    const zap = numeroDeZap(r.whatsapp);

    // Os itens que ELA tem, e não os que a pessoa pediu: mandar no
    // WhatsApp um item que a revenda não vende começa a conversa com
    // uma recusa.
    const temEstes = estado.pedido.filter((i) => r.precos && r.precos[i.id] !== undefined);
    // O endereço entra só na hora do clique, em completarZap().
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
                    ${r.faz_entrega === false ? '<span class="selo so-balcao">Só no balcão</span>' : ""}
                    ${r.faz_retirada === false ? '<span class="selo so-entrega">Só entrega</span>' : ""}
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
                   data-zap="${esc(zap)}" data-texto="${esc(texto)}"
                   target="_blank" rel="noopener">
                    Pedir no WhatsApp
                </a>
            </div>
        </article>
    `;
}


/** Zera o pedido: desmarca tudo e tira a lista, que respondia a ele. */
function limparPedido() {
    estado.pedido = [];
    abrirTipo(estado.tipo);
    desenharPedido();
    document.getElementById("resultados").hidden = true;
}


/**
 * O endereço entra na mensagem na hora do clique, e não quando o cartão
 * foi desenhado. O mapa e a lista aparecem assim que o CEP é achado, e
 * o número e o complemento costumam ser digitados depois disso.
 */
function completarZap(link) {
    let texto = link.dataset.texto;
    const campos = lerCampos();

    // Pelo GPS não existe endereço escrito, e mandar coordenada para o
    // balcão não ajuda ninguém. Na retirada, o endereço não interessa.
    if (estado.modo === "entrega" && estado.onde && estado.onde.como === "endereco" && campos.rua) {
        texto += "\nEndereço: " + enderecoEscrito(campos);
    }

    link.href = "https://wa.me/" + link.dataset.zap + "?text=" + encodeURIComponent(texto);
}


/* ==========================================
   LIGAR A TELA
========================================== */

(async function iniciar() {
    document.getElementById("botao-gps").addEventListener("click", usarGps);
    document.getElementById("form-endereco").addEventListener("submit", usarEndereco);
    document.getElementById("rua").addEventListener("input", aoDigitarRua);
    document.getElementById("so-abertas").addEventListener("change", (evento) => {
        estado.soAbertas = evento.target.checked;
        desenharLista();
    });

    document.addEventListener("click", (evento) => {
        const tipo = evento.target.closest("[data-tipo]");
        if (tipo) { abrirTipo(tipo.dataset.tipo); return; }

        const modo = evento.target.closest("[data-modo]");
        if (modo) { escolherModo(modo.dataset.modo); return; }

        const ordem = evento.target.closest("[data-ordem]");
        if (ordem) { escolherOrdem(ordem.dataset.ordem); return; }

        const item = evento.target.closest("[data-item]");
        if (item) { alternarItem(item.dataset.item); return; }

        const tirar = evento.target.closest("[data-tirar]");
        if (tirar) { alternarItem(tirar.dataset.tirar); return; }

        if (evento.target.closest("[data-limpar-pedido]")) { limparPedido(); return; }

        const zap = evento.target.closest(".botao-zap");
        if (zap) completarZap(zap);
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
        if (lembrado && Number.isFinite(lembrado.lat)) {
            if (lembrado.campos) preencherCampos(lembrado.campos);
            definirOnde(lembrado);
        }
    } catch (e) {
        // Nada guardado, ou guardado torto. Começa do zero.
    }
})();
