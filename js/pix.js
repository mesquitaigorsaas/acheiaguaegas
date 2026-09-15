// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: pix.js
// Versão: 1.0
// ==========================================

/*
   O pagamento da assinatura por Pix, enquanto a cobrança não é
   automática.

   A revenda escolhe o plano, paga pelo QR Code ou pelo copia e cola, e
   manda o comprovante pelo WhatsApp com a mensagem já escrita: nome,
   CNPJ e plano. É o comprovante que diz QUEM pagou — num extrato, cinco
   Pix de R$ 9,90 são iguais.

   O QR Code é o BR Code do Banco Central, montado aqui mesmo. Estático:
   sem banco no meio, sem chave de API, e com o valor já preenchido para
   ninguém pagar o plano errado.

   Precisa de: utils.js (esc, dinheiro, numeroDeZap), planos.js (PLANOS,
   PLANO_PADRAO, PIX) e, para o desenho do QR, a biblioteca
   qrcode-generator. Sem a biblioteca, o copia e cola continua valendo.
*/


/* ==========================================
   O CÓDIGO PIX
========================================== */

/** Um campo do BR Code: identificador, tamanho com dois dígitos e valor. */
function campoPix(id, valor) {
    return id + String(valor.length).padStart(2, "0") + valor;
}

/** Sem acento e só o que o padrão aceita, cortado no tamanho do campo. */
function textoPix(texto, maximo) {
    return String(texto || "")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9 ]/g, "")
        .trim()
        .toUpperCase()
        .slice(0, maximo);
}

/** O CRC16-CCITT que fecha o código. Com ele errado, o app do banco recusa. */
function crcPix(texto) {
    let crc = 0xFFFF;

    for (let i = 0; i < texto.length; i++) {
        crc ^= texto.charCodeAt(i) << 8;
        for (let b = 0; b < 8; b++) {
            crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xFFFF;
        }
    }

    return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * O "copia e cola" do Pix, que também é o conteúdo do QR Code.
 *
 * O identificador leva o começo do id da revenda. Nem todo banco mostra
 * no extrato, mas quando mostra, é a revenda escrita ali.
 */
function codigoPix({ chave, recebedor, cidade, valor, identificador }) {
    const conta = campoPix("00", "br.gov.bcb.pix") + campoPix("01", String(chave).trim());
    const txid = textoPix(identificador, 25).replace(/ /g, "") || "***";

    const semCrc =
        campoPix("00", "01")
        + campoPix("26", conta)
        + campoPix("52", "0000")
        + campoPix("53", "986")
        + campoPix("54", Number(valor).toFixed(2))
        + campoPix("58", "BR")
        + campoPix("59", textoPix(recebedor, 25))
        + campoPix("60", textoPix(cidade, 15))
        + campoPix("62", campoPix("05", txid))
        + "6304";

    return semCrc + crcPix(semCrc);
}


/* ==========================================
   A CAIXA DE PAGAMENTO
========================================== */

function cnpjEscrito(cnpj) {
    return String(cnpj || "")
        .replace(/\D/g, "")
        .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** O QR Code em SVG, ou vazio se a biblioteca não carregou. */
function qrDoCodigo(codigo) {
    if (typeof qrcode !== "function") return "";

    const qr = qrcode(0, "M");
    qr.addData(codigo);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

/**
 * Desenha a caixa de pagamento dentro de `onde`.
 *
 * revenda: { id, nome, cnpj }. O id vai no identificador do Pix; o nome
 * e o CNPJ vão na mensagem do comprovante.
 */
function desenharPagamento(onde, revenda) {
    const configurado = PIX.chave && PIX.recebedor && PIX.whatsapp;

    if (!configurado) {
        onde.innerHTML = `
            <div class="pagar">
                <h3>Falta ativar a sua revenda</h3>
                <p class="explica">
                    O pagamento por Pix está sendo configurado e aparece aqui
                    em breve.
                </p>
            </div>`;
        onde.hidden = false;
        return;
    }

    let plano = PLANO_PADRAO;
    let codigo = "";

    function desenhar() {
        const p = planoOu(plano);

        codigo = codigoPix({
            chave: PIX.chave,
            recebedor: PIX.recebedor,
            cidade: PIX.cidade,
            valor: p.preco,
            identificador: "AAG" + String(revenda.id || "").replace(/-/g, "")
        });

        const linhas = ["Olá! Paguei a assinatura do *Achei Água & Gás*.", ""];
        linhas.push("*Revenda:* " + (revenda.nome || ""));
        if (revenda.cnpj) linhas.push("*CNPJ:* " + cnpjEscrito(revenda.cnpj));
        linhas.push("*Plano:* " + p.nome + " — " + dinheiro(p.preco));
        linhas.push("", "Segue o comprovante.");

        const qr = qrDoCodigo(codigo);

        onde.innerHTML = `
            <div class="pagar">
                <h3>Ative a sua revenda</h3>
                <p class="explica">
                    Pague por Pix e mande o comprovante. Assim que a gente
                    conferir, a sua revenda entra na busca e o painel abre.
                </p>

                <div class="planos-pagar" role="group" aria-label="Plano">
                    ${Object.keys(PLANOS).map((id) => `
                        <button type="button" class="plano-pagar${id === plano ? " escolhido" : ""}"
                                data-plano="${esc(id)}" aria-pressed="${id === plano}">
                            <strong>${esc(PLANOS[id].nome)}</strong>
                            <span>${esc(PLANOS[id].valor)}</span>
                            <small>${esc(PLANOS[id].resumo)}</small>
                        </button>
                    `).join("")}
                </div>

                ${qr ? `<div class="qr-pix" aria-label="QR Code do Pix">${qr}</div>` : ""}
                <p class="valor-pix">Valor: <strong>${esc(dinheiro(p.preco))}</strong></p>

                <label class="rotulo-copia" for="copia-pix">Pix copia e cola</label>
                <div class="copia-cola">
                    <input type="text" id="copia-pix" readonly value="${esc(codigo)}">
                    <button type="button" class="botao-vazio botao-miudo" data-copiar-pix>Copiar</button>
                </div>

                <p class="chave-pix">
                    Ou pague pela chave aleatória:<br>
                    <code>${esc(PIX.chave)}</code>
                </p>

                <a class="botao botao-zap" target="_blank" rel="noopener"
                   href="https://wa.me/${esc(numeroDeZap(PIX.whatsapp))}?text=${encodeURIComponent(linhas.join("\n"))}">
                    Enviar comprovante pelo WhatsApp
                </a>
                <p class="dica-pagar">
                    A conversa abre com o nome da revenda e o plano já escritos.
                    É só anexar o comprovante.
                </p>
            </div>`;

        onde.hidden = false;
    }

    // Um ouvinte só, na caixa: o conteúdo é redesenhado a cada troca de
    // plano, e ouvintes presos aos botões iriam embora junto.
    onde.onclick = async (evento) => {
        const botaoPlano = evento.target.closest("[data-plano]");
        if (botaoPlano) {
            plano = botaoPlano.dataset.plano;
            desenhar();
            return;
        }

        const copiar = evento.target.closest("[data-copiar-pix]");
        if (copiar) {
            try {
                await navigator.clipboard.writeText(codigo);
            } catch (e) {
                // Sem permissão de área de transferência: seleciona o
                // texto, e a pessoa copia com o dedo.
                const campo = document.getElementById("copia-pix");
                campo.select();
                document.execCommand("copy");
            }
            copiar.textContent = "Copiado!";
            setTimeout(() => { copiar.textContent = "Copiar"; }, 2000);
        }
    };

    desenhar();
}
