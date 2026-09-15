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
    "P13": { forma: "botijao", largura: 46, altura: 62, rotulo: "P13", popular: "Botijão de cozinha", medida: "13 kg" },
    "P45": { forma: "botijao", largura: 52, altura: 86, rotulo: "P45", popular: "Botijão grande", medida: "45 kg · comércio" },
    "P8":  { forma: "botijao", largura: 40, altura: 50, rotulo: "P8",  popular: "Botijão médio", medida: "8 kg" },
    "P5":  { forma: "botijao", largura: 34, altura: 42, rotulo: "P5",  popular: "Botijão pequeno", medida: "5 kg" },
    "P2":  { forma: "botijao", largura: 30, altura: 34, rotulo: "P2",  popular: "Camping e fogareiro", medida: "2 kg" },

    // ÁGUA
    "20L":         { forma: "galao",     largura: 50, altura: 80, rotulo: "20L",   popular: "Galão de bebedouro", medida: "20 litros" },
    "10L":         { forma: "galaoAlca", largura: 44, altura: 58, rotulo: "10L",   popular: "Galão médio", medida: "10 litros" },
    "5L":          { forma: "galaoAlca", largura: 36, altura: 46, rotulo: "5L",    popular: "Galão pequeno", medida: "5 litros" },
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


function botijao(d) {
    const w = d.largura;
    const h = d.altura;
    const pe = 5;
    const alca = Math.round(h * 0.17);   // o aro de cima, que protege a válvula
    const topo = CHAO - h;
    const corpoY = topo + alca;
    const corpoH = h - alca - pe + 2;    // encosta no pé
    const fonte = Math.min(15, Math.round(w * 0.32));

    return `
        <svg ${CAIXA}>
            <rect class="d-gas-escuro" x="${n(MEIO - w * 0.36)}" y="${CHAO - pe}" width="${n(w * 0.72)}" height="${pe}" rx="1.5"/>
            <rect class="d-gas-escuro" x="${n(MEIO - w * 0.3)}" y="${topo}" width="${n(w * 0.6)}" height="${alca + 6}" rx="4"/>
            <rect class="d-furo" x="${n(MEIO - w * 0.17)}" y="${topo + 3}" width="${n(w * 0.34)}" height="${n(alca * 0.42)}" rx="2"/>
            <rect class="d-gas-corpo" x="${n(MEIO - w / 2)}" y="${corpoY}" width="${w}" height="${corpoH}" rx="${n(w * 0.3)}"/>
            <rect class="d-brilho" x="${n(MEIO - w / 2 + w * 0.13)}" y="${n(corpoY + corpoH * 0.2)}" width="${n(w * 0.08)}" height="${n(corpoH * 0.6)}" rx="${n(w * 0.04)}"/>
            <text class="d-texto d-texto-gas" x="${MEIO}" y="${n(corpoY + corpoH / 2)}" font-size="${fonte}" text-anchor="middle" dominant-baseline="central">${esc(d.rotulo)}</text>
        </svg>`;
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


const FORMAS = { botijao, galao, galaoAlca, fardo };

/**
 * O desenho e os nomes de um item, ou null quando ainda não há desenho
 * para ele — aí a tela mostra o apelido em texto, como antes.
 */
function desenhoDoItem(item) {
    const d = DESENHOS[item.apelido];
    if (!d || !FORMAS[d.forma]) return null;

    return { svg: FORMAS[d.forma](d), popular: d.popular, medida: d.medida };
}
