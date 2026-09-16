// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: desenhos.js
// Versão: 2.0
// ==========================================

/*
   A figura de cada item do catálogo, com o nome do dia a dia embaixo.

   Pouca gente sabe que o botijão da cozinha se chama P13. A pessoa
   conhece pelo tamanho e pelo formato: "o de cozinha", "o grandão do
   restaurante". A figura responde isso sem ninguém precisar perguntar.

   A chave é o apelido do catálogo. Item novo sem figura aqui continua
   aparecendo, só que como texto: não quebra nada.

   OS BOTIJÕES SÃO FOTOS, e não desenho. Muita gente escolhe pela
   imagem, e um desenho aproximado manda a pessoa pedir o botijão
   errado. As fotos ficam em assets/botijoes/web, em cópias leves (os
   originais ficam na pasta de cima, fora do site), e já trazem a
   etiqueta vermelha com a sigla.

   A ÁGUA CONTINUA EM SVG escrito à mão.
*/

/*
   As fotos foram feitas na mesma escala: a sigla tem a mesma altura em
   todas. Por isso cada uma aparece com a altura dela vezes o mesmo
   fator, e o P90 fica do tamanho que é perto do P2 — com as etiquetas
   iguais lado a lado.

   `alturaFoto` é a altura do arquivo original, em pixels.
*/
const ESCALA_FOTO = 0.17;

const DESENHOS = {
    // GÁS, na ordem de tamanho: é a ordem da tabela das distribuidoras,
    // e a da tela. O P8 não tem foto e usa o desenho prateado.
    "P2":  { foto: "p2",  alturaFoto: 299, tamanho: 1, popular: "Camping e fogareiro", medida: "2 kg" },
    "P5":  { foto: "p5",  alturaFoto: 365, tamanho: 2, popular: "Botijão pequeno", medida: "5 kg" },
    "P8":  { forma: "gasP13", largura: 26, altura: 34, rotulo: "P8", tamanho: 3, popular: "Botijão médio", medida: "8 kg" },
    "P13": { foto: "p13", alturaFoto: 423, tamanho: 4, popular: "Botijão de cozinha", medida: "13 kg" },
    "P20": { foto: "p20", alturaFoto: 551, tamanho: 5, popular: "Empilhadeira", medida: "20 kg" },
    "P45": { foto: "p45", alturaFoto: 711, tamanho: 6, popular: "Botijão grande", medida: "45 kg · comércio" },
    "P90": { foto: "p90", alturaFoto: 743, tamanho: 7, popular: "Botijão industrial", medida: "90 kg" },

    // ÁGUA, também em ordem numérica, pelo tamanho da embalagem.
    // "Galão de água", sempre inteiro: "galão" sozinho não diz do quê.
    "Fardo 500ml": { forma: "fardo", garrafas: 4, largura: 12, altura: 42, rotulo: "500ml", tamanho: 1, popular: "Fardo de garrafinhas", medida: "12 × 500 ml" },
    "Fardo 1,5L":  { forma: "fardo", garrafas: 3, largura: 16, altura: 60, rotulo: "1,5L",  tamanho: 2, popular: "Fardo de garrafas", medida: "6 × 1,5 litro" },
    "Galão de água 5L":  { forma: "galaoAlca", largura: 36, altura: 46, rotulo: "5L",  tamanho: 3, popular: "Galão de água", medida: "5 litros" },
    "Galão de água 10L": { forma: "galaoAlca", largura: 44, altura: 58, rotulo: "10L", tamanho: 4, popular: "Galão de água", medida: "10 litros" },
    "Galão de água 20L": { forma: "galao",     largura: 50, altura: 80, rotulo: "20L", tamanho: 5, popular: "Galão de água", medida: "20 litros" }
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
   O BOTIJÃO SEM FOTO

   Hoje só o P8. Desenhado no estilo das fotos — prata, com a etiqueta
   vermelha da sigla embaixo — para não destoar dos outros até a foto
   dele chegar. Com a foto, ele entra no DESENHOS como os demais e
   tudo isto pode sair.
------------------------------------------ */

const CHAO_GAS = 80;
const ETIQUETA_LARGURA = 28;

/*
   O prateado é um degradê da esquerda para a direita: escuro nas
   bordas e claro perto do meio, que é o que faz um retângulo parecer
   cilindro de metal. Cada desenho ganha o seu, com nome próprio: dois
   SVGs na mesma página com o mesmo id brigam, e o que some leva o
   degradê do outro junto.
*/
let degradesCriados = 0;

function metal() {
    const id = "metal-" + (++degradesCriados);
    const tons = ["#858b91", "#c9cdd1", "#f5f6f7", "#b4b9be", "#7a8086"];
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
function botijaoDe(d, pecas) {
    const m = metal();
    const x = MEIO - ETIQUETA_LARGURA / 2;
    const F = CHAO_GAS;

    return `
        <svg ${CAIXA}>
            ${m.defs}
            <polygon class="d-etiqueta-cunha" points="${n(x)},${F} ${n(x + ETIQUETA_LARGURA)},${F - 16} ${n(x + ETIQUETA_LARGURA)},${F}"/>
            ${pecas(m.cor, d.largura, d.altura, F)}
            <rect class="d-etiqueta" x="${n(x)}" y="${F}" width="${ETIQUETA_LARGURA}" height="12"/>
            <text class="d-texto d-texto-etiqueta" x="${MEIO}" y="${F + 6.5}" font-size="9" text-anchor="middle" dominant-baseline="central">${esc(d.rotulo)}</text>
        </svg>`;
}


/**
 * No molde do P13, que é o que o P8 parece: largo, com a costura no
 * meio, o aro vazado das duas alças em cima e o pé com recortes.
 */
function gasP13(d) {
    return botijaoDe(d, (cor, w, h, F) => {
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


const FORMAS = { gasP13, galao, galaoAlca, fardo };

/** A foto de um botijão, na altura que a escala comum dá a ela. */
function foto(d) {
    const altura = Math.round(d.alturaFoto * ESCALA_FOTO);
    return `<img class="item-foto" src="assets/botijoes/web/${esc(d.foto)}.png" alt=""
                 style="--altura: ${altura}" decoding="async">`;
}

/**
 * A figura e os nomes de um item, ou null quando ainda não há figura
 * para ele — aí a tela mostra o apelido em texto, como antes.
 */
function desenhoDoItem(item) {
    const d = DESENHOS[item.apelido];
    if (!d) return null;

    if (d.foto) return { figura: foto(d), popular: d.popular, medida: d.medida, foto: true };
    if (!FORMAS[d.forma]) return null;

    return { figura: FORMAS[d.forma](d), popular: d.popular, medida: d.medida, foto: false };
}

/**
 * Os itens em ordem numérica, do menor para o maior: P2, P5, P8, P13,
 * P20, P45, P90. É a ordem da tabela das distribuidoras, e é como a
 * pessoa compara: o do lado é maior ou menor que o meu? Quem não tem
 * figura mantém a ordem do catálogo, depois dos outros.
 *
 * O banco guarda a mesma ordem (008-p20-p90.sql), para o painel da
 * revenda listar igual; esta aqui vale mesmo antes de ele rodar.
 */
function ordenarPorTamanho(itens) {
    const tamanho = (i) => (DESENHOS[i.apelido] && DESENHOS[i.apelido].tamanho) || Infinity;
    return [...itens].sort((a, b) => tamanho(a) - tamanho(b));
}
