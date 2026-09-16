// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: desenhos.js
// Versão: 1.0
// ==========================================

/*
   O desenho de cada item do catálogo, com o nome dentro.

   Pouca gente sabe que o botijão da cozinha se chama P13. A pessoa
   conhece pelo tamanho e pelo uso: "o de cozinha", "o grandão do
   restaurante". O desenho em proporção, com o nome do dia a dia
   embaixo, responde isso sem ninguém precisar perguntar.

   A chave é o apelido do catálogo. Item novo sem desenho aqui continua
   aparecendo, só que como texto: não quebra nada.

   Tudo é SVG escrito à mão, sem imagem para baixar. No celular do
   bairro, dez fotos de botijão seriam segundos a mais antes de a
   pessoa conseguir tocar em alguma coisa.
*/

const DESENHOS = {
    // GÁS
    // Prateados, como na foto que a revenda e o cliente conhecem, cada
    // modelo com o seu formato: é pelo formato que a pessoa reconhece o
    // botijão, muito antes de ler a sigla. A sigla vai embaixo, na
    // etiqueta vermelha, como nas tabelas das distribuidoras.
    //
    // As alturas seguem a ordem real (P2 < P5 < P13 < P20 < P45 < P90),
    // mas comprimidas: na proporção exata o P2 viraria um ponto.
    "P2":  { forma: "gasP2",  largura: 26, altura: 24, rotulo: "P2",  popular: "Camping e fogareiro", medida: "2 kg" },
    "P5":  { forma: "gasP5",  largura: 30, altura: 32, rotulo: "P5",  popular: "Botijão pequeno", medida: "5 kg" },
    "P8":  { forma: "gasP13", largura: 36, altura: 36, rotulo: "P8",  popular: "Botijão médio", medida: "8 kg" },
    "P13": { forma: "gasP13", largura: 42, altura: 42, rotulo: "P13", popular: "Botijão de cozinha", medida: "13 kg" },
    "P20": { forma: "gasP20", largura: 22, altura: 62, rotulo: "P20", popular: "Empilhadeira", medida: "20 kg" },
    "P45": { forma: "gasP45", largura: 28, altura: 74, rotulo: "P45", popular: "Botijão grande", medida: "45 kg · comércio" },
    "P90": { forma: "gasP90", largura: 50, altura: 78, rotulo: "P90", popular: "Botijão industrial", medida: "90 kg" },

    // ÁGUA
    // "Galão de água", sempre inteiro: "galão" sozinho não diz do quê.
    "Galão de água 20L": { forma: "galao",     largura: 50, altura: 80, rotulo: "20L", popular: "Galão de água", medida: "20 litros" },
    "Galão de água 10L": { forma: "galaoAlca", largura: 44, altura: 58, rotulo: "10L", popular: "Galão de água", medida: "10 litros" },
    "Galão de água 5L":  { forma: "galaoAlca", largura: 36, altura: 46, rotulo: "5L",  popular: "Galão de água", medida: "5 litros" },
    "Fardo 1,5L":  { forma: "fardo", garrafas: 3, largura: 16, altura: 60, rotulo: "1,5L",  popular: "Fardo de garrafas", medida: "6 × 1,5 litro" },
    "Fardo 500ml": { forma: "fardo", garrafas: 4, largura: 12, altura: 42, rotulo: "500ml", popular: "Fardo de garrafinhas", medida: "12 × 500 ml" }
};

// Todos os desenhos pisam no mesmo chão e dividem a mesma caixa: é o
// que deixa o P45 visivelmente maior que o P2 lado a lado.
const CAIXA = `viewBox="0 0 80 96" aria-hidden="true" focusable="false"`;
const MEIO = 40;
const CHAO = 92;

/** Uma casa decimal basta, e o SVG fica legível. */
function n(v) {
    return Math.round(v * 10) / 10;
}


/* ------------------------------------------
   OS BOTIJÕES

   O botijão pisa mais alto que o galão: embaixo dele fica a etiqueta
   vermelha com a sigla, e o pé do botijão encosta nela, como na
   tabela das distribuidoras.
------------------------------------------ */

const CHAO_GAS = 80;
const ETIQUETA_LARGURA = 34;

/*
   O prateado é um degradê da esquerda para a direita: escuro nas
   bordas e claro perto do meio, que é o que faz um retângulo parecer
   cilindro de metal. Cada desenho ganha o seu, com nome próprio: dois
   SVGs na mesma página com o mesmo id brigam, e o que some leva o
   degradê do outro junto.
*/
let degradesCriados = 0;

function metal(escuro) {
    const id = "metal-" + (++degradesCriados);
    // O P45 é o cinza-chumbo da foto; os outros, prata clara.
    const tons = escuro
        ? ["#4f555b", "#9aa0a6", "#dfe2e5", "#8c9298", "#4a5056"]
        : ["#858b91", "#c9cdd1", "#f5f6f7", "#b4b9be", "#7a8086"];
    const paradas = [0, 0.28, 0.45, 0.72, 1];

    return {
        cor: `url(#${id})`,
        defs: `<defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">`
            + tons.map((c, i) => `<stop offset="${paradas[i]}" stop-color="${c}"/>`).join("")
            + `</linearGradient></defs>`
    };
}

/** Um retângulo pintado de metal, com os números já arredondados. */
function chapa(cor, x, y, w, h, rx = 0) {
    return `<rect fill="${cor}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}"/>`;
}

/** Uma peça escura: válvula, furo do aro, recorte do pé. */
function peca(classe, x, y, w, h, rx = 0) {
    return `<rect class="${classe}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}"/>`;
}

/** A linha da solda que dá a volta no corpo. */
function costura(w, y) {
    return `<line class="d-metal-costura" x1="${n(MEIO - w / 2 + 2)}" x2="${n(MEIO + w / 2 - 2)}" y1="${n(y)}" y2="${n(y)}"/>`;
}

/**
 * Monta o SVG de um botijão: a cunha vermelha atrás do pé, o botijão
 * que `pecas` desenha, e a etiqueta com a sigla por cima de tudo.
 */
function botijaoDe(d, escuro, pecas) {
    const m = metal(escuro);
    const x = MEIO - ETIQUETA_LARGURA / 2;
    const F = CHAO_GAS;

    return `
        <svg ${CAIXA}>
            ${m.defs}
            <polygon class="d-etiqueta-cunha" points="${n(x)},${F} ${n(x + ETIQUETA_LARGURA)},${F - 16} ${n(x + ETIQUETA_LARGURA)},${F}"/>
            ${pecas(m.cor, d.largura, d.altura, F)}
            <rect class="d-etiqueta" x="${n(x)}" y="${F}" width="${ETIQUETA_LARGURA}" height="14"/>
            <text class="d-texto d-texto-etiqueta" x="${MEIO}" y="${F + 7.5}" font-size="10.5" text-anchor="middle" dominant-baseline="central">${esc(d.rotulo)}</text>
        </svg>`;
}


/** P2: bojudo e baixinho, com a válvula à mostra e sem aro. */
function gasP2(d) {
    return botijaoDe(d, false, (cor, w, h, F) =>
        peca("d-metal-escuro", MEIO - w * 0.32, F - 3, w * 0.64, 3, 1)
        + chapa(cor, MEIO - 3, F - h + 1.5, 6, h * 0.26)
        + chapa(cor, MEIO - w / 2, F - h * 0.8, w, h * 0.8 - 2, w * 0.42)
        + peca("d-metal-escuro", MEIO - 4.5, F - h, 9, 2.5, 1)
    );
}


/** P5: corpo curto, aro baixo em cima e pé com recorte. */
function gasP5(d) {
    return botijaoDe(d, false, (cor, w, h, F) =>
        chapa(cor, MEIO - w * 0.36, F - 5, w * 0.72, 5, 1)
        + peca("d-metal-furo", MEIO - w * 0.12, F - 3, w * 0.24, 3)
        + chapa(cor, MEIO - w * 0.34, F - h, w * 0.68, h * 0.32, 2)
        + peca("d-metal-furo", MEIO - w * 0.22, F - h + 2, w * 0.44, h * 0.32 - 5, 1.5)
        + chapa(cor, MEIO - 1.5, F - h + 3, 3, h * 0.32 - 4)
        + chapa(cor, MEIO - w / 2, F - h * 0.74, w, h * 0.74 - 4, w * 0.3)
    );
}


/**
 * P13, e o P8 no mesmo molde: o de cozinha. Largo, com a costura no
 * meio, o aro vazado das duas alças em cima e o pé com recortes.
 */
function gasP13(d) {
    return botijaoDe(d, false, (cor, w, h, F) => {
        const corpoY = F - h * 0.78;
        const corpoH = h * 0.78 - 5;
        const aroH = h * 0.32;

        return chapa(cor, MEIO - w * 0.38, F - 6, w * 0.76, 6, 1)
            + peca("d-metal-furo", MEIO - w * 0.26, F - 3, w * 0.12, 3)
            + peca("d-metal-furo", MEIO + w * 0.14, F - 3, w * 0.12, 3)
            + chapa(cor, MEIO - w * 0.36, F - h, w * 0.72, aroH, 2.5)
            + peca("d-metal-furo", MEIO - w * 0.3, F - h + 2.5, w * 0.2, h * 0.1, 1.5)
            + peca("d-metal-furo", MEIO + w * 0.1, F - h + 2.5, w * 0.2, h * 0.1, 1.5)
            + peca("d-metal-escuro", MEIO - 2, F - h + 2, 4, aroH - 3, 1)
            + chapa(cor, MEIO - w / 2, corpoY, w, corpoH, w * 0.28)
            + costura(w, corpoY + corpoH / 2);
    });
}


/** P20: o de empilhadeira. Alto e fino, com a luva aberta em cima. */
function gasP20(d) {
    return botijaoDe(d, false, (cor, w, h, F) => {
        const corpoY = F - h * 0.8;
        const luvaH = h * 0.22;

        return chapa(cor, MEIO - w * 0.46, F - 5, w * 0.92, 5)
            + peca("d-metal-furo", MEIO - w * 0.15, F - 2.5, w * 0.3, 2.5)
            + chapa(cor, MEIO - w / 2, corpoY, w, h * 0.8 - 4, 4)
            + costura(w, corpoY + 6)
            + chapa(cor, MEIO - w / 2, F - h, w, luvaH, 1)
            + `<ellipse class="d-metal-furo" cx="${MEIO}" cy="${n(F - h + 1.8)}" rx="${n(w / 2 - 1.5)}" ry="1.8"/>`
            + peca("d-metal-furo", MEIO - w / 2, F - h + 4, w * 0.3, h * 0.07);
    });
}


/**
 * P45: alto, cinza-chumbo, com o topo em cúpula e a válvula exposta,
 * sem aro.
 */
function gasP45(d) {
    return botijaoDe(d, true, (cor, w, h, F) => {
        const cupulaY = F - h * 0.9;

        return chapa(cor, MEIO - w * 0.46, F - 6, w * 0.92, 6, 1)
            + chapa(cor, MEIO - 3, F - h + 3, 6, 8)
            + chapa(cor, MEIO - w / 2, cupulaY, w, w, w / 2)
            + chapa(cor, MEIO - w / 2, cupulaY + w / 2, w, F - 4 - (cupulaY + w / 2), 2)
            + costura(w, cupulaY + h * 0.22)
            + peca("d-metal-escuro", MEIO - 4, F - h + 2, 8, 4, 1)
            + peca("d-metal-escuro", MEIO - 6, F - h, 12, 2, 1);
    });
}


/**
 * P90: o maior e o mais largo. Ombros redondos, costura no meio, uma
 * luva pequena em volta da válvula e o pé largo com recortes.
 */
function gasP90(d) {
    return botijaoDe(d, false, (cor, w, h, F) => {
        const corpoY = F - h * 0.84;
        const corpoH = F - 5 - corpoY;

        return chapa(cor, MEIO - w * 0.42, F - 7, w * 0.84, 7, 1.5)
            + peca("d-metal-furo", MEIO - w * 0.3, F - 3.5, w * 0.14, 3.5)
            + peca("d-metal-furo", MEIO + w * 0.16, F - 3.5, w * 0.14, 3.5)
            + chapa(cor, MEIO - w * 0.18, F - h + 3, w * 0.36, h * 0.13, 2)
            + peca("d-metal-furo", MEIO - w * 0.12, F - h + 5, w * 0.24, h * 0.05, 1)
            + chapa(cor, MEIO - w / 2, corpoY, w, corpoH, w * 0.3)
            + costura(w, corpoY + corpoH / 2)
            + peca("d-metal-escuro", MEIO - 2.5, F - h, 5, 4, 1);
    });
}


/** O garrafão de bebedouro: gargalo estreito e tampa, sem alça. */
function galao(d) {
    const w = d.largura;
    const h = d.altura;
    const tampa = 6;
    const gargalo = Math.round(h * 0.14);
    const topo = CHAO - h;
    const corpoY = topo + tampa + gargalo;
    const corpoH = CHAO - corpoY - 1;
    const fonte = Math.min(15, Math.round(w * 0.3));

    return `
        <svg ${CAIXA}>
            <rect class="d-agua-corpo" x="${n(MEIO - w * 0.15)}" y="${topo + tampa - 1}" width="${n(w * 0.3)}" height="${gargalo + 6}" rx="2"/>
            <rect class="d-agua-escuro" x="${n(MEIO - w * 0.2)}" y="${topo}" width="${n(w * 0.4)}" height="${tampa}" rx="2"/>
            <rect class="d-agua-corpo" x="${n(MEIO - w / 2)}" y="${corpoY}" width="${w}" height="${corpoH}" rx="${n(w * 0.24)}"/>
            <line class="d-costura" x1="${n(MEIO - w / 2 + 5)}" x2="${n(MEIO + w / 2 - 5)}" y1="${n(corpoY + corpoH * 0.2)}" y2="${n(corpoY + corpoH * 0.2)}"/>
            <line class="d-costura" x1="${n(MEIO - w / 2 + 5)}" x2="${n(MEIO + w / 2 - 5)}" y1="${n(corpoY + corpoH * 0.82)}" y2="${n(corpoY + corpoH * 0.82)}"/>
            <text class="d-texto d-texto-agua" x="${MEIO}" y="${n(corpoY + corpoH / 2)}" font-size="${fonte}" text-anchor="middle" dominant-baseline="central">${esc(d.rotulo)}</text>
        </svg>`;
}


/** O galão menor, de alça em cima e tampa de lado. */
function galaoAlca(d) {
    const w = d.largura;
    const h = d.altura;
    const alcaH = Math.round(h * 0.2);
    const topo = CHAO - h;
    const corpoY = topo + alcaH;
    const corpoH = CHAO - corpoY - 1;
    const fonte = Math.min(15, Math.round(w * 0.32));

    return `
        <svg ${CAIXA}>
            <rect class="d-agua-alca" x="${n(MEIO + w * 0.02)}" y="${topo + 1.5}" width="${n(w * 0.36)}" height="${alcaH + 8}" rx="5"/>
            <rect class="d-agua-escuro" x="${n(MEIO - w * 0.36)}" y="${n(topo + alcaH * 0.35)}" width="${n(w * 0.24)}" height="${n(alcaH * 0.65 + 3)}" rx="2"/>
            <rect class="d-agua-corpo" x="${n(MEIO - w / 2)}" y="${corpoY}" width="${w}" height="${corpoH}" rx="${n(w * 0.14)}"/>
            <text class="d-texto d-texto-agua" x="${MEIO}" y="${n(corpoY + corpoH / 2)}" font-size="${fonte}" text-anchor="middle" dominant-baseline="central">${esc(d.rotulo)}</text>
        </svg>`;
}


/** Garrafas lado a lado, com a cinta do fardo e a medida escrita nela. */
function fardo(d) {
    const q = d.garrafas;
    const bw = d.largura;
    const h = d.altura;
    const folga = 2;
    const total = q * bw + (q - 1) * folga;
    const x0 = MEIO - total / 2;
    const topo = CHAO - h;
    const ombro = topo + 3 + h * 0.14;

    let garrafas = "";
    for (let i = 0; i < q; i++) {
        const x = x0 + i * (bw + folga);
        garrafas += `
            <rect class="d-agua-garrafa" x="${n(x + bw * 0.32)}" y="${topo + 3}" width="${n(bw * 0.36)}" height="${n(h * 0.18)}" rx="1"/>
            <rect class="d-agua-escuro" x="${n(x + bw * 0.28)}" y="${topo}" width="${n(bw * 0.44)}" height="4" rx="1"/>
            <rect class="d-agua-garrafa" x="${n(x)}" y="${n(ombro)}" width="${bw}" height="${n(CHAO - ombro - 1)}" rx="${n(bw * 0.3)}"/>`;
    }

    const faixaY = n(CHAO - h * 0.52);

    return `
        <svg ${CAIXA}>
            ${garrafas}
            <rect class="d-agua-escuro" x="${n(x0 - 3)}" y="${faixaY}" width="${n(total + 6)}" height="16" rx="3"/>
            <text class="d-texto d-texto-faixa" x="${MEIO}" y="${n(faixaY + 8)}" font-size="10.5" text-anchor="middle" dominant-baseline="central">${esc(d.rotulo)}</text>
        </svg>`;
}


const FORMAS = { gasP2, gasP5, gasP13, gasP20, gasP45, gasP90, galao, galaoAlca, fardo };

/**
 * O desenho e os nomes de um item, ou null quando ainda não há desenho
 * para ele — aí a tela mostra o apelido em texto, como antes.
 */
function desenhoDoItem(item) {
    const d = DESENHOS[item.apelido];
    if (!d || !FORMAS[d.forma]) return null;

    return { svg: FORMAS[d.forma](d), popular: d.popular, medida: d.medida };
}
