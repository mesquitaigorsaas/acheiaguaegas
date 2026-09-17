// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: busca.js
// Versão: 3.0
// ==========================================

/*
   A tela do cliente, de cima para baixo:

     1. onde entregar — o mapa já abre na localização do aparelho, e a
        pessoa só completa o número e a observação. Ou toca em "entregar
        em outro endereço" e digita a rua ou o CEP.
     2. o que você quer
     3. a lista, que se refaz sozinha

   O SITE VALE PARA O BRASIL INTEIRO. Não existe escolha de cidade: a
   busca mede a distância a partir do ponto, e o raio de entrega de cada
   revenda decide quem atende ali.

   O GPS DECIDE A LISTA, E NÃO A ENTREGA. Dentro de casa ele erra de
   quarteirão, e o entregador precisa de rua e número. Por isso a rua
   que o mapa achou aparece escrita para a pessoa conferir, o número é
   digitado por ela, e o WhatsApp não abre sem ele. Se a rua estiver
   errada, "entregar em outro endereço" resolve.

   NÃO EXISTE BOTÃO DE CONFIRMAR. Quem já disse onde está e marcou o
   botijão respondeu tudo o que a busca precisa. Marcar outro item, ou
   trocar entre entregar e buscar, refaz a lista na hora.

   O PEDIDO É UMA LISTA, e não um item só. Quem está com o botijão
   vazio muitas vezes está com o galão vazio também, e comprar os dois
   na mesma revenda é uma entrega em vez de duas.

   O que a pessoa respondeu fica guardado no navegador: o outro
   endereço, e o número e a observação de quem usa a localização. Quem
   pede gás pede de novo do mesmo lugar.
*/

// O outro endereço digitado. A chave é a mesma de quando só existia
// o endereço escrito, e o que ficou guardado daquela época continua
// servindo.
const GUARDADO = "achei-agua-gas:onde";
// O número e a observação de quem usa a localização, com a rua a que
// eles pertencem: em outra rua, não valem.
const GUARDADO_AQUI = "achei-agua-gas:aqui";

const estado = {
    // Onde o aparelho disse que a pessoa está:
    // { lat, lng, precisao, campos: { rua, bairro, cidade, uf } }.
    // campos é null quando o mapa não achou nome de rua.
    aqui: null,
    // true quando a entrega é no endereço digitado, e não no do aparelho.
    usandoOutro: false,
    // O outro endereço já achado no mapa, para voltar a ele sem procurar.
    outro: null,
    // O ponto que a busca usa agora: { lat, lng, escrito, como, campos }.
    onde: null,
    tipo: "gas",      // a aba aberta: "gas" ou "agua"
    pedido: [],       // os itens marcados, na ordem em que foram marcados
    modo: "entrega",  // "entrega" ou "retirada"
    ordem: "distancia", // "distancia" ou "preco"
    quantidades: {},  // quantos de cada item marcado: { id: 2 }
    // O que mais a pessoa quer perguntar (chaves de js/extras.js). Não
    // entra no total nem na ordem: vai na mensagem, preço a consultar.
    extras: [],
    pagamento: null,  // "pix", "debito", "credito" ou "dinheiro"
    // Vem DESMARCADO: a lista mostra todo mundo, e o horário é
    // informação, não corte. Quem quiser ver só quem atende agora
    // marca a caixa.
    soAbertas: false
};

let catalogo = [];

// As formas de pagamento, com o nome inteiro (mensagem) e o curto (selo).
// As chaves são as mesmas da coluna revendas.pagamentos.
const PAGAMENTOS = {
    pix:      { nome: "Pix",               curto: "Pix" },
    debito:   { nome: "Cartão de débito",  curto: "débito" },
    credito:  { nome: "Cartão de crédito", curto: "crédito" },
    dinheiro: { nome: "Dinheiro",          curto: "dinheiro" }
};

// Acima disto a posição é do computador de mesa ou de um celular sem
// GPS ligado, e costuma errar o bairro. A pessoa é avisada.
const PRECISAO_DUVIDOSA_M = 500;


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

function valorDe(id) {
    return document.getElementById(id).value.trim();
}

function guardar(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {
        // Navegador anônimo, ou site bloqueado de guardar. A busca
        // funciona igual; só não lembra na próxima visita.
    }
}

function lembrar(chave) {
    try {
        return JSON.parse(localStorage.getItem(chave) || "null");
    } catch (e) {
        return null;
    }
}


/* ==========================================
   PASSO 1 — ONDE ENTREGAR
========================================== */

// Os campos do outro endereço, na ordem do formulário.
const CAMPOS_OUTRO = ["rua", "numero", "complemento", "bairro", "cidade", "uf"];

function lerFormulario() {
    const campos = {};
    CAMPOS_OUTRO.forEach((id) => { campos[id] = valorDe(id); });
    return campos;
}

function preencherFormulario(campos) {
    CAMPOS_OUTRO.forEach((id) => {
        if (campos[id] !== undefined && campos[id] !== null) {
            document.getElementById(id).value = campos[id];
        }
    });
}

/**
 * O endereço da entrega, do jeito que vai para o WhatsApp: o digitado,
 * ou o do aparelho com o número e a observação escritos pela pessoa.
 */
function lerCampos() {
    if (estado.usandoOutro) return lerFormulario();

    const a = (estado.aqui && estado.aqui.campos) || {};
    return {
        rua: a.rua || "",
        numero: valorDe("numero-aqui"),
        complemento: valorDe("complemento-aqui"),
        bairro: a.bairro || "",
        cidade: a.cidade || "",
        uf: a.uf || ""
    };
}

/** "Rua X, 120, apto 302 - Centro, Belo Horizonte/MG". */
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


/* ------------------------------------------
   A localização do aparelho
------------------------------------------ */

async function localizar() {
    const explica = document.getElementById("explica-onde");
    explica.textContent = "Procurando onde você está...";

    let posicao;
    try {
        posicao = await ondeEstouPeloAparelho(12000);
    } catch (erro) {
        // Sem localização, o outro endereço é o único caminho, e ele já
        // abre: um botão a mais para chegar ao formulário seria só atrito.
        explica.textContent = erro.message;
        document.getElementById("botao-aqui").hidden = true;
        abrirOutro();
        return;
    }

    explica.textContent = "Achando o nome da rua...";
    const campos = await enderecoDaCoordenada(posicao.lat, posicao.lng);

    estado.aqui = { lat: posicao.lat, lng: posicao.lng, precisao: posicao.precisao, campos };

    // O número e a observação da última vez, se a rua for a mesma.
    const guardado = lembrar(GUARDADO_AQUI);
    if (campos && guardado && guardado.rua === campos.rua) {
        document.getElementById("numero-aqui").value = guardado.numero || "";
        document.getElementById("complemento-aqui").value = guardado.complemento || "";
    }
    if (campos && campos.numero) {
        document.getElementById("numero-aqui").placeholder = "Ex: " + campos.numero;
    }

    // A pessoa pode ter aberto o outro endereço enquanto o GPS demorava.
    // O que ela escolheu vale mais do que o que o aparelho respondeu.
    if (!estado.usandoOutro) usarAqui();
}


/** Volta para o endereço do aparelho. */
function usarAqui() {
    if (!estado.aqui) return;

    estado.usandoOutro = false;
    pedidoDeLugar++;

    const campos = estado.aqui.campos;
    const aproximada = estado.aqui.precisao > PRECISAO_DUVIDOSA_M;

    document.getElementById("form-endereco").hidden = true;
    document.getElementById("botao-aqui").hidden = true;
    document.getElementById("botao-outro").hidden = false;
    document.getElementById("campos-aqui").hidden = !campos;
    document.getElementById("aviso-endereco").hidden = true;

    const explica = document.getElementById("explica-onde");
    if (!campos) {
        explica.textContent = "Achamos você no mapa, mas não o nome da rua. "
            + "A lista já mostra quem atende aí; para a entrega, use outro endereço.";
    } else if (aproximada) {
        explica.textContent = "A sua localização veio aproximada, com erro de uns "
            + kmEscrito(estado.aqui.precisao / 1000) + ". Confira a rua abaixo; "
            + "se não for a sua, entregue em outro endereço.";
    } else {
        explica.textContent = "Confira a rua e complete com o número.";
    }

    definirOnde({
        lat: estado.aqui.lat,
        lng: estado.aqui.lng,
        // Sem o número do mapa, que é palpite: o que vale é o que a
        // pessoa digitar no campo.
        escrito: campos ? enderecoEscrito({ ...campos, numero: "" }) : "a sua localização",
        como: "aparelho",
        campos
    });
}


/** Abre o formulário do outro endereço. */
function abrirOutro() {
    estado.usandoOutro = true;

    document.getElementById("form-endereco").hidden = false;
    document.getElementById("campos-aqui").hidden = true;
    document.getElementById("botao-outro").hidden = true;
    document.getElementById("botao-aqui").hidden = !estado.aqui;
    document.getElementById("aviso-endereco").hidden = true;

    // A cidade e o estado do aparelho servem de ponto de partida: quase
    // sempre o outro endereço é na mesma cidade.
    const a = estado.aqui && estado.aqui.campos;
    if (a && !valorDe("cidade")) preencherFormulario({ cidade: a.cidade, uf: a.uf });

    if (estado.outro) {
        definirOnde(estado.outro);
        return;
    }

    // Ainda sem outro endereço achado: o mapa e a lista do aparelho saem
    // da tela, senão a pessoa veria preços de um lugar onde não vai
    // receber.
    esconderOnde();
    document.getElementById("rua").focus();
}


function esconderOnde() {
    estado.onde = null;
    document.getElementById("resumo-onde").hidden = true;
    const mapa = document.getElementById("mapa-onde");
    mapa.hidden = true;
    mapa.innerHTML = "";
    delete mapa.dataset.ponto;
    document.getElementById("resultados").hidden = true;
}


/* ------------------------------------------
   O outro endereço, digitado
------------------------------------------ */

/*
   O CEP de que veio a rua que está no campo. Sai quando a pessoa mexe
   na rua: com a rua trocada à mão, a coordenada do CEP antigo mediria
   a distância do lugar errado.
*/
let cepDaRua = null;
let cepProcurado = null;

/*
   Cada busca de lugar ganha um número, e só a resposta da última vale.
   Sem isso, a busca que o CEP disparou podia chegar depois da que o
   bairro corrigido disparou, e passar por cima dela — ou a do outro
   endereço chegar depois de a pessoa ter voltado para a localização.
*/
let pedidoDeLugar = 0;

async function aoDigitarRua() {
    const campoRua = document.getElementById("rua");
    const cep = cepNoCampo(campoRua.value);

    cepDaRua = null;
    if (!cep) { cepProcurado = null; return; }
    if (cep === cepProcurado) return;
    cepProcurado = cep;

    const vez = pedidoDeLugar;
    campoRua.classList.add("buscando");
    const achado = await enderecoDoCep(cep);
    campoRua.classList.remove("buscando");

    // A pessoa continuou digitando, ou já buscou outro endereço, enquanto
    // o CEP ia e voltava.
    if (vez !== pedidoDeLugar || cepNoCampo(campoRua.value) !== cep) return;

    if (!achado) {
        cepProcurado = null;
        avisar("Não achei esse CEP. Confira os números, ou escreva o nome da rua.", "erro");
        return;
    }

    avisar("");
    campoRua.value = achado.rua;
    preencherFormulario({ bairro: achado.bairro, cidade: achado.cidade, uf: achado.uf.toUpperCase() });
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

    const campos = lerFormulario();

    if (!campos.rua) {
        avisar("Escreva a rua, ou use o CEP no lugar dela.", "erro");
        return;
    }

    // Sem cidade, "Rua São Paulo" é rua de qualquer lugar do país.
    if (!campos.cidade || !campos.uf) {
        avisar("Preencha a cidade e o estado, ou use o CEP.", "erro");
        document.getElementById(campos.cidade ? "uf" : "cidade").focus();
        return;
    }

    const vez = ++pedidoDeLugar;
    const botao = document.querySelector("#form-endereco button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Procurando...";
    avisar("");

    const cepDigitado = cepNoCampo(campos.rua);
    const achado = await ondeFica({
        cep: cepDigitado || cepDaRua,
        rua: cepDigitado ? null : campos.rua,
        bairro: campos.bairro,
        cidade: campos.cidade,
        uf: campos.uf
    });

    botao.disabled = false;
    botao.textContent = "Achar este endereço";

    // Enquanto o mapa procurava, outra busca de lugar começou, ou a
    // pessoa voltou para a localização do aparelho.
    if (vez !== pedidoDeLugar || !estado.usandoOutro) return;

    if (!achado) {
        avisar("Não achei esse endereço. Confira a rua, o bairro e a cidade.", "erro");
        return;
    }

    estado.outro = {
        lat: achado.lat,
        lng: achado.lng,
        escrito: enderecoEscrito(campos),
        como: "endereco",
        campos
    };
    guardar(GUARDADO, estado.outro);

    definirOnde(estado.outro);
}


/* ------------------------------------------
   O ponto da busca
------------------------------------------ */

function definirOnde(onde) {
    estado.onde = onde;

    const resumo = document.getElementById("resumo-onde");
    const rotulo = onde.como === "aparelho" ? "Você está em" : "Entregar em";
    resumo.innerHTML = esc(rotulo) + "<small>" + esc(onde.escrito) + "</small>";
    resumo.hidden = false;

    desenharMapa(onde);

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
        `<iframe src="https://maps.google.com/maps?q=${ponto}&z=17&output=embed"
                 title="Onde entregar, no mapa" loading="lazy"></iframe>
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

    itens.innerHTML = ordenarPorTamanho(catalogo.filter((i) => i.tipo === tipo))
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
                    <span class="item-figura${desenho.foto ? " com-foto" : ""}">${desenho.figura}</span>
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
        delete estado.quantidades[id];
    } else {
        estado.pedido.push(item);
        estado.quantidades[id] = 1;
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


/**
 * Mais um ou menos um. Abaixo de um não desce: tirar do pedido é o ×.
 *
 * Não vai ao banco. O preço de cada item já veio na busca, e o total
 * com a quantidade é refeito aqui.
 */
function mudarQuantidade(id, passo) {
    if (!noPedido(id)) return;

    const atual = estado.quantidades[id] || 1;
    const nova = Math.min(20, Math.max(1, atual + passo));
    if (nova === atual) return;

    estado.quantidades[id] = nova;
    desenharPedido();

    if (!document.getElementById("resultados").hidden) desenharLista();
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
        // Esvazia além de esconder: a ficha do último item não pode
        // continuar lá dentro esperando a caixa reaparecer.
        caixa.innerHTML = "";
        caixa.hidden = true;
        return;
    }

    caixa.hidden = false;

    caixa.innerHTML = "<span class='rotulo-pedido'>Seu pedido</span>"
        + estado.pedido.map((i) => {
            const qtd = estado.quantidades[i.id] || 1;
            const nome = esc(i.apelido || i.nome);

            return `
                <div class="ficha">
                    <button type="button" data-menos="${esc(i.id)}"
                            aria-label="Um ${nome} a menos" ${qtd <= 1 ? "disabled" : ""}>&minus;</button>
                    <span class="ficha-nome">${qtd} ${nome}</span>
                    <button type="button" data-mais="${esc(i.id)}"
                            aria-label="Mais um ${nome}">+</button>
                    <button type="button" class="ficha-tirar" data-tirar="${esc(i.id)}"
                            title="Tirar do pedido" aria-label="Tirar ${nome} do pedido">&times;</button>
                </div>`;
        }).join("");

}


/* ------------------------------------------
   O que mais a pessoa quer perguntar
------------------------------------------ */

function desenharExtrasDoPedido() {
    const marcados = new Set(estado.extras);

    document.getElementById("chips-extras").innerHTML = EXTRAS.map((e) => `
        <button type="button" class="chip-extra${marcados.has(e.id) ? " escolhido" : ""}"
                data-extra-pedido="${esc(e.id)}" aria-pressed="${marcados.has(e.id)}">
            ${esc(e.nome)}${seloMaiores(e)}
        </button>`).join("");

    // Aberto enquanto houver algo marcado: fechar esconderia da pessoa
    // o que vai na mensagem.
    if (estado.extras.length) document.getElementById("extras-pedido").open = true;
}

function alternarExtra(id) {
    if (!extraPorId(id)) return;

    estado.extras = estado.extras.includes(id)
        ? estado.extras.filter((x) => x !== id)
        : [...estado.extras, id];

    desenharExtrasDoPedido();

    // Não vai ao banco: a busca já trouxe o que cada revenda vende.
    if (!document.getElementById("resultados").hidden) desenharLista();
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

    // Na retirada nada é entregue: o endereço é só de onde a pessoa sai.
    document.getElementById("titulo-onde").textContent =
        modo === "retirada" ? "Onde você está" : "Local da entrega";
    document.getElementById("botao-outro").textContent =
        modo === "retirada" ? "Buscar a partir de outro endereço" : "Entregar em outro endereço";

    if (estado.onde && estado.pedido.length) procurar();
}


/* ==========================================
   COMO VAI PAGAR
========================================== */

/**
 * A forma de pagamento. Vai na mensagem, e acende no cartão da revenda
 * que não a aceita — cartão recusado na porta é o entregador voltando
 * com o botijão.
 */
function escolherPagamento(forma) {
    estado.pagamento = forma;

    document.querySelectorAll("[data-pagamento]").forEach((b) => {
        b.classList.toggle("escolhido", b.dataset.pagamento === forma);
    });

    // Troco só existe no dinheiro.
    document.getElementById("campo-troco").hidden = forma !== "dinheiro";
    document.getElementById("aviso-pagamento").hidden = true;

    if (!document.getElementById("resultados").hidden) desenharLista();
}

/** Sem forma escolhida ainda, ninguém é marcado como "não aceita". */
function aceitaPagamento(r) {
    return !estado.pagamento || !Array.isArray(r.pagamentos) || r.pagamentos.includes(estado.pagamento);
}

/** A taxa só vale na entrega. Quem busca no balcão não paga frete. */
function taxaDe(r) {
    return estado.modo === "entrega" ? Number(r.taxa_entrega) || 0 : 0;
}

/**
 * O total que a pessoa paga NESTA revenda: o preço de cada item vezes a
 * quantidade, mais a taxa quando é entrega. É este, e não o total do
 * banco — que soma um de cada, sem frete —, que ordena por preço e
 * decide a mais barata.
 */
function totalDe(r) {
    const itens = estado.pedido.reduce((soma, i) => {
        const p = r.precos ? r.precos[i.id] : undefined;
        return p === undefined ? soma : soma + Number(p) * (estado.quantidades[i.id] || 1);
    }, 0);

    return Math.round((itens + taxaDe(r)) * 100) / 100;
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
    // E que aceitam o pagamento escolhido: a mais barata que recusa o
    // cartão da pessoa não é opção para ela.
    const completasAbertas = achados.filter((r) => r.aberta && r.itens_encontrados === pedidos && aceitaPagamento(r));
    const menorTotal = completasAbertas.length
        ? Math.min(...completasAbertas.map(totalDe))
        : null;

    const emOrdem = ordenar(achados, pedidos);
    const completas = emOrdem.filter((r) => r.itens_encontrados === pedidos);
    const parciais = emOrdem.filter((r) => r.itens_encontrados !== pedidos);

    // Quem não tem o pedido inteiro vem depois, sob um título. Sem ele,
    // uma revenda de total menor aparecia abaixo de uma mais cara, e a
    // ordem por preço parecia quebrada — quando o total só era menor
    // porque faltava item.
    lista.innerHTML = completas.map((r) => cartao(r, pedidos, menorTotal)).join("")
        + (parciais.length
            ? `<p class="grupo-parcial">${completas.length ? "Não têm tudo o que você pediu" : "Ninguém tem tudo o que você pediu"}</p>`
              + parciais.map((r) => cartao(r, pedidos, menorTotal)).join("")
            : "");
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

        // Entre as que têm só parte, primeiro a que tem mais do pedido.
        if (!aCompleta && a.itens_encontrados !== b.itens_encontrados) {
            return b.itens_encontrados - a.itens_encontrados;
        }

        return totalDe(a) - totalDe(b);
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
    const aceita = aceitaPagamento(r);
    const total = totalDe(r);
    const taxa = taxaDe(r);
    const maisBarata = completa && r.aberta && aceita && total === menorTotal;

    const qtdDe = (i) => estado.quantidades[i.id] || 1;
    const umSo = pedidos === 1 && qtdDe(estado.pedido[0]) === 1;

    const zap = numeroDeZap(r.whatsapp);


    const logo = r.logo_url
        ? `<img class="logo" src="${esc(r.logo_url)}" alt="" loading="lazy">`
        // Sem logo, a lojinha do CSS: a mesma de quando a revenda se cadastra.
        : `<div class="logo logo-vazia" aria-hidden="true"></div>`;

    // Com um item só, um de cada e sem taxa, o detalhamento repetiria o
    // total logo ao lado. Com quantidade ou com taxa, ele mostra de onde
    // veio a soma.
    const detalhe = !umSo || taxa > 0
        ? `<ul class="detalhe-itens">` + estado.pedido.map((i) => {
            const p = r.precos ? r.precos[i.id] : undefined;
            const nome = (qtdDe(i) > 1 ? qtdDe(i) + "× " : "") + (i.apelido || i.nome);
            return p === undefined
                // "Em falta", e não "não vende": a revenda pode só estar
                // sem estoque hoje. O detalhamento já diz o que falta, e
                // por isso o cartão não precisa de selo contando itens.
                ? `<li class="falta"><s>${esc(nome)}</s><span>Em falta</span></li>`
                : `<li>${esc(nome)}<span>${esc(dinheiro(Number(p) * qtdDe(i)))}</span></li>`;
          }).join("")
          + (taxa > 0 ? `<li>Taxa de entrega<span>${esc(dinheiro(taxa))}</span></li>` : "")
          + `</ul>`
        : "";

    const rotuloPreco = taxa > 0
        ? "total com entrega"
        : (umSo ? (estado.pedido[0].apelido || estado.pedido[0].nome) : "total");

    return `
        <article class="revenda${maisBarata ? " melhor" : ""}${r.aberta ? "" : " fechada"}">
            ${logo}

            <div class="miolo">
                <h3>${esc(r.nome)}</h3>
                <div class="linha-selos">
                    <span class="selo ${r.aberta ? "aberta" : "fechada"}">${r.aberta ? "Aberta agora" : "Fechada"}</span>
                    ${maisBarata ? '<span class="selo mais-barata">Mais barata</span>' : ""}
                    ${r.faz_entrega === false ? '<span class="selo so-balcao">Só no balcão</span>' : ""}
                    ${r.faz_retirada === false ? '<span class="selo so-entrega">Só entrega</span>' : ""}
                    ${estado.modo === "entrega"
                        ? (taxa > 0
                            ? `<span class="selo taxa">Entrega ${esc(dinheiro(taxa))}</span>`
                            : '<span class="selo entrega-gratis">Entrega grátis</span>')
                        : ""}
                    ${aceita ? "" : `<span class="selo nao-aceita">Não aceita ${esc(PAGAMENTOS[estado.pagamento].curto)}</span>`}
                    <span>${esc(kmEscrito(r.distancia_km) || "")}</span>
                </div>
            </div>

            <div class="preco">
                ${esc(dinheiro(total))}
                <small>${esc(rotuloPreco)}</small>
            </div>

            ${detalhe}

            ${r.endereco
                // O km diz o quanto; o bairro diz o onde. Quem mora na
                // cidade confia mais em "Centro" do que em "1,7 km".
                ? `<p class="endereco-revenda"><span>Endereço:</span> ${esc(r.endereco)}</p>`
                : ""}

            ${tambemVende(r)}

            <div class="acao-revenda">
                <a class="botao botao-zap" href="https://wa.me/${esc(zap)}"
                   data-zap="${esc(zap)}" data-revenda="${esc(r.revenda_id)}"
                   target="_blank" rel="noopener">
                    Pedir no WhatsApp
                </a>
            </div>
        </article>
    `;
}


/* ------------------------------------------
   Os exemplos da entrada
------------------------------------------ */

/*
   Três revendas inventadas, para quem acabou de chegar entender a lista
   antes de marcar qualquer coisa. Nomes genéricos, sem imitar empresa
   nenhuma, e sem WhatsApp. Mostram as situações que a lista de verdade
   tem: a mais barata, a que cobra entrega, a que está fechada e só
   atende no balcão, e o "também vende".
*/
const EXEMPLOS = [
    {
        nome: "Gás e Água do Bairro",
        selos: [["aberta", "Aberta agora"], ["mais-barata", "Mais barata"], ["entrega-gratis", "Entrega grátis"]],
        km: 0.8,
        preco: 105,
        rotulo: "Botijão P13",
        endereco: "Rua das Flores, 120 — Centro",
        extras: ["mangueira_gas", "registro_gas"],
        melhor: true
    },
    {
        nome: "Distribuidora Boa Vista",
        selos: [["aberta", "Aberta agora"], ["taxa", "Entrega R$ 5,00"]],
        km: 1.9,
        preco: 115,
        rotulo: "total com entrega",
        endereco: "Av. Brasil, 845 — Boa Vista",
        extras: ["carvao", "gelo", "cerveja"]
    },
    {
        nome: "Águas do Vale",
        selos: [["fechada", "Fechada"], ["so-balcao", "Só no balcão"]],
        km: 3.4,
        preco: 108,
        rotulo: "Botijão P13",
        endereco: "Rua São João, 57 — Vila Nova",
        extras: ["suporte_galao", "bomba_galao"],
        fechada: true
    }
];

function desenharExemplos() {
    document.getElementById("lista-exemplos").innerHTML = EXEMPLOS.map((e) => `
        <article class="revenda exemplo${e.melhor ? " melhor" : ""}${e.fechada ? " fechada" : ""}" aria-label="Exemplo: ${esc(e.nome)}">
            <div class="logo logo-vazia" aria-hidden="true"></div>

            <div class="miolo">
                <h3><span class="selo-exemplo">Exemplo</span> ${esc(e.nome)}</h3>
                <div class="linha-selos">
                    ${e.selos.map(([classe, texto]) => `<span class="selo ${classe}">${esc(texto)}</span>`).join("")}
                    <span>${esc(kmEscrito(e.km))}</span>
                </div>
            </div>

            <div class="preco">
                ${esc(dinheiro(e.preco))}
                <small>${esc(e.rotulo)}</small>
            </div>

            <p class="endereco-revenda"><span>Endereço:</span> ${esc(e.endereco)}</p>

            ${tambemVende({ extras: e.extras })}

            <div class="acao-revenda">
                <span class="botao botao-exemplo" aria-disabled="true">Pedir no WhatsApp · exemplo</span>
            </div>
        </article>`).join("");
}

/**
 * Os exemplos saem quando a lista de verdade entra, e voltam quando ela
 * sai. Vigiando o próprio atributo da lista, e não cada lugar que a
 * mostra ou esconde: são cinco, e esquecer um deixaria os dois juntos.
 */
function ligarExemplos() {
    const resultados = document.getElementById("resultados");
    const exemplos = document.getElementById("exemplos");
    const acertar = () => { exemplos.hidden = !resultados.hidden; };

    new MutationObserver(acertar).observe(resultados, { attributes: true, attributeFilter: ["hidden"] });
    desenharExemplos();
    acertar();
}


/**
 * "Também vende: carvão · gelo", preço a consultar. O que a pessoa
 * marcou para perguntar vem destacado, e primeiro: é o que ela procura
 * neste cartão.
 */
function tambemVende(r) {
    const vende = extrasDe(r.extras);
    if (!vende.length) return "";

    const quer = new Set(estado.extras);
    const emOrdem = [...vende.filter((e) => quer.has(e.id)), ...vende.filter((e) => !quer.has(e.id))];

    return `
        <p class="tambem-vende">
            <span>Também vende</span>
            ${emOrdem.map((e) => `<em class="${quer.has(e.id) ? "quer" : ""}">${esc(e.curto)}${seloMaiores(e)}</em>`).join("")}
            <small>preço a consultar</small>
        </p>`;
}


/**
 * A mensagem é montada na hora do clique, e não quando o cartão foi
 * desenhado: o número, o complemento e o troco costumam ser digitados
 * depois de a lista aparecer.
 *
 * Sem forma de pagamento, o clique não sai. Responder uma pergunta
 * antes é melhor do que descobrir na porta que a revenda não aceita.
 */
// O que a entrega não dispensa, no outro endereço. O complemento fica
// de fora: casa não tem.
const OBRIGATORIOS_DO_OUTRO = [
    { id: "rua",    nome: "a rua" },
    { id: "numero", nome: "o número" },
    { id: "bairro", nome: "o bairro" },
    { id: "cidade", nome: "a cidade" },
    { id: "uf",     nome: "o estado" }
];

/**
 * O que falta no endereço da entrega, como um problema para o
 * completarZap, ou null.
 *
 * Na localização do aparelho, a rua, o bairro e a cidade vieram do
 * mapa; da pessoa só se cobra o número. Sem rua achada, a única saída
 * é o outro endereço.
 */
function faltaNoEndereco() {
    if (!estado.usandoOutro) {
        if (!estado.aqui || !estado.aqui.campos) {
            return {
                aviso: "aviso-endereco",
                alvo: "botao-outro",
                texto: "Não achamos o nome da sua rua. Toque em \"Entregar em outro endereço\" e escreva a rua ou o CEP."
            };
        }

        if (!valorDe("numero-aqui")) {
            document.getElementById("numero-aqui").classList.add("faltando");
            return {
                aviso: "aviso-endereco",
                alvo: "numero-aqui",
                texto: "Para a entrega, falta o número."
            };
        }

        return null;
    }

    const faltam = OBRIGATORIOS_DO_OUTRO.filter((c) => !valorDe(c.id));
    faltam.forEach((c) => document.getElementById(c.id).classList.add("faltando"));

    if (faltam.length) {
        return {
            aviso: "aviso-endereco",
            alvo: faltam[0].id,
            texto: "Para a entrega, falta preencher " + emLista(faltam.map((c) => c.nome)) + "."
        };
    }

    return null;
}

function completarZap(evento, link) {
    const r = achadosDaVez.find((x) => x.revenda_id === link.dataset.revenda);
    const problemas = [];

    if (!estado.pagamento) {
        problemas.push({
            aviso: "aviso-pagamento",
            alvo: "pagamentos",
            texto: "Escolha como vai pagar. A revenda precisa saber antes de sair com o pedido."
        });
    } else {
        // Troco para menos que o total é número trocado, e o entregador
        // só descobre na porta, sem dinheiro para voltar.
        const troco = lerTroco();
        if (r && estado.pagamento === "dinheiro" && troco && troco < totalDe(r)) {
            problemas.push({
                aviso: "aviso-pagamento",
                alvo: "troco",
                texto: "O troco precisa ser para mais que o total desta revenda, "
                    + dinheiro(totalDe(r)) + ". Confira o valor ou deixe em branco."
            });
        }
    }

    // O endereço só é exigido na entrega. Quem vai buscar não precisa
    // dizer onde mora para o balcão.
    if (estado.modo === "entrega") {
        const falta = faltaNoEndereco();
        if (falta) problemas.push(falta);
    }

    document.getElementById("aviso-pagamento").hidden = true;
    document.getElementById("aviso-endereco").hidden = true;

    if (problemas.length) {
        // Não abre o WhatsApp. Mostra tudo o que falta de uma vez — um
        // aviso por clique faria a pessoa voltar três vezes — e leva até
        // o primeiro.
        evento.preventDefault();

        problemas.forEach((p) => {
            const aviso = document.getElementById(p.aviso);
            aviso.textContent = p.texto;
            aviso.hidden = false;
        });

        const alvo = document.getElementById(problemas[0].alvo);
        alvo.scrollIntoView({ behavior: "smooth", block: "center" });
        if (alvo.matches("input, select")) alvo.focus({ preventScroll: true });
        return;
    }

    // O número e a observação digitados na localização ficam para a
    // próxima vez, presos à rua a que pertencem.
    if (!estado.usandoOutro && estado.aqui && estado.aqui.campos) {
        guardar(GUARDADO_AQUI, {
            rua: estado.aqui.campos.rua,
            numero: valorDe("numero-aqui"),
            complemento: valorDe("complemento-aqui")
        });
    }

    if (r) link.href = "https://wa.me/" + link.dataset.zap + "?text=" + encodeURIComponent(mensagemDoPedido(r));
}


/*
   Formatada para o WhatsApp: *negrito* nos títulos, e "* " no começo da
   linha vira lista. É o que o balcão lê de relance, com o telefone numa
   mão e outro cliente na frente.
*/
function mensagemDoPedido(r) {
    // Os itens que ELA tem, e não os que a pessoa pediu: mandar no
    // WhatsApp um item que a revenda não vende começa a conversa com
    // uma recusa.
    const temEstes = estado.pedido.filter((i) => r.precos && r.precos[i.id] !== undefined);
    const campos = lerCampos();
    const entrega = estado.modo === "entrega";
    const taxa = taxaDe(r);

    const linhas = [
        "Olá! Vi no Achei Água & Gás.",
        "*Preciso de:*",
        "",
        ...temEstes.map((i) => "* " + (estado.quantidades[i.id] || 1) + " " + i.nome),
        ""
    ];

    // Só o que ELA vende, pelo mesmo motivo dos itens: perguntar preço
    // de algo que a revenda não tem começa a conversa com um "não".
    const vende = new Set(r.extras || []);
    const perguntar = EXTRAS.filter((e) => estado.extras.includes(e.id) && vende.has(e.id));
    if (perguntar.length) {
        linhas.push("*Quanto custa:* " + emLista(perguntar.map((e) => e.curto)) + "?", "");
    }

    linhas.push(entrega
        ? "*Entrega:* " + (taxa > 0 ? dinheiro(taxa) : "grátis")
        : "*Retirada:* vou buscar no balcão");

    linhas.push("*Total:* " + dinheiro(totalDe(r)));

    let pagamento = PAGAMENTOS[estado.pagamento].nome;
    const troco = lerTroco();
    if (estado.pagamento === "dinheiro" && troco) pagamento += " — troco para " + dinheiro(troco);
    linhas.push("*Pagamento:* " + pagamento);

    // Na retirada, o endereço não interessa ao balcão.
    if (entrega && estado.onde && campos.rua) {
        linhas.push("*Endereço:* " + enderecoEscrito(campos));
    }

    return linhas.join("\n");
}


/** "100", "100,00", "R$ 100,00" e "100.00" viram 100. Vazio ou torto, null. */
function lerTroco() {
    const t = document.getElementById("troco").value.replace(/[^\d,.]/g, "");
    if (!t) return null;

    // Com vírgula, o ponto é de milhar; sem vírgula, o ponto é o decimal.
    const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    return Number.isFinite(n) && n > 0 ? n : null;
}


/* ==========================================
   LIGAR A TELA
========================================== */

(async function iniciar() {
    opcoesDeEstado(document.getElementById("uf"), "", true);
    desenharExtrasDoPedido();
    ligarExemplos();

    document.getElementById("form-endereco").addEventListener("submit", usarEndereco);
    document.getElementById("rua").addEventListener("input", aoDigitarRua);
    document.getElementById("botao-outro").addEventListener("click", abrirOutro);
    document.getElementById("botao-aqui").addEventListener("click", usarAqui);

    // Preencheu o campo apontado, o vermelho sai; preencheu todos, o
    // aviso sai. Vale para o número da localização e para o formulário.
    const passoOnde = document.getElementById("passo-onde");
    ["input", "change"].forEach((tipo) => {
        passoOnde.addEventListener(tipo, (evento) => {
            evento.target.classList.remove("faltando");
            if (!passoOnde.querySelector(".faltando")) {
                document.getElementById("aviso-endereco").hidden = true;
            }
        });
    });

    // O bairro é o que escolhe o trecho certo de uma avenida comprida.
    // Corrigido à mão depois de o mapa aparecer, o pino se ajusta
    // sozinho, sem precisar tocar em "achar este endereço".
    document.getElementById("bairro").addEventListener("change", () => {
        if (estado.usandoOutro && estado.outro && valorDe("rua")) usarEndereco();
    });

    // O outro endereço da última vez fica pronto no formulário, mas não
    // passa na frente da localização: quem abrir o site em outro lugar
    // quer a lista de onde está agora.
    const lembrado = lembrar(GUARDADO);
    if (lembrado && Number.isFinite(lembrado.lat) && lembrado.campos && lembrado.campos.rua) {
        preencherFormulario(lembrado.campos);
        estado.outro = lembrado;
    }

    // Sem esperar o catálogo: o navegador pergunta da localização logo
    // de cara, enquanto os botijões carregam.
    localizar();
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

        const pagamento = evento.target.closest("[data-pagamento]");
        if (pagamento) { escolherPagamento(pagamento.dataset.pagamento); return; }

        const extra = evento.target.closest("[data-extra-pedido]");
        if (extra) { alternarExtra(extra.dataset.extraPedido); return; }

        const menos = evento.target.closest("[data-menos]");
        if (menos) { mudarQuantidade(menos.dataset.menos, -1); return; }

        const mais = evento.target.closest("[data-mais]");
        if (mais) { mudarQuantidade(mais.dataset.mais, 1); return; }

        const item = evento.target.closest("[data-item]");
        if (item) { alternarItem(item.dataset.item); return; }

        const tirar = evento.target.closest("[data-tirar]");
        if (tirar) { alternarItem(tirar.dataset.tirar); return; }

        const zap = evento.target.closest(".botao-zap");
        if (zap) completarZap(evento, zap);
    });

    try {
        catalogo = await carregarCatalogo();
    } catch (erro) {
        console.error("Erro ao carregar o catálogo:", erro);
        avisar("Não consegui carregar a lista de produtos. Recarregue a página.", "erro");
        return;
    }

    abrirTipo("gas");
})();
