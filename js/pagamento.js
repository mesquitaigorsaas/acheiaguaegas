// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: pagamento.js
// Versão: 2.0
// ==========================================

/*
   A caixa de pagamento da assinatura, por Pix, com liberação
   automática pelo Mercado Pago.

   Aparece em três lugares: no fim do cadastro, no login de quem ainda
   não pagou ou deixou vencer, e no painel, para renovar.

   A revenda escolhe o plano e pede o Pix. A Edge Function
   pagar-assinatura cria a cobrança no Mercado Pago e devolve o QR Code;
   quando o dinheiro cai, o Mercado Pago avisa a webhook-mercadopago, e
   é ela que libera a revenda. Esta tela só acompanha a linha do
   pagamento no banco e avisa quando caiu.

   Cada QR Code é uma cobrança própria, com valor e revenda amarrados.
   Por isso não existe mais comprovante: o Mercado Pago sabe quem pagou.

   Precisa de: utils.js (esc, dinheiro, numeroDeZap), banco.js
   (conectar) e planos.js (PLANOS, PLANO_PADRAO, SUPORTE). E de uma
   sessão aberta: a Edge Function cobra a revenda de quem está logado.
*/

// O Pix vale por 24 horas, mas ninguém fica meia hora olhando o QR.
// Depois disso a tela para de perguntar e manda recarregar.
const ESPERA_MAXIMA_MS = 30 * 60 * 1000;
const INTERVALO_ESPERA_MS = 5000;

let caixasCriadas = 0;


/** "2027-09-12" vira "12/09/2027". */
function dataDoVencimento(iso) {
    const [a, m, d] = String(iso || "").slice(0, 10).split("-");
    return d && m && a ? d + "/" + m + "/" + a : "";
}


/**
 * Desenha a caixa de pagamento dentro de `onde`.
 *
 * opcoes:
 *   titulo, explica — o texto do topo, para o painel falar em renovar
 *   aoPagar(r)      — chamado quando o pagamento for confirmado
 */
function desenharPagamento(onde, opcoes = {}) {
    onde.hidden = false;

    const idCaixa = "pix-" + (++caixasCriadas);
    let plano = PLANO_PADRAO;
    let pagamentoEmEspera = null;

    onde.innerHTML = `
        <div class="pagar">
            <h3>${esc(opcoes.titulo || "Ative a sua revenda")}</h3>
            <p class="explica">${esc(opcoes.explica || "Pague por Pix. Assim que o pagamento cair, a sua revenda entra na busca e o painel abre — sem mandar comprovante.")}</p>

            <div data-escolha>
                <div class="planos-pagar" role="group" aria-label="Plano" data-planos></div>
                <p class="recado erro" role="alert" data-erro hidden></p>
                <button type="button" class="botao" data-gerar></button>
            </div>

            <div data-resultado hidden></div>
        </div>`;

    const caixaEscolha = onde.querySelector("[data-escolha]");
    const caixaPlanos = onde.querySelector("[data-planos]");
    const caixaErro = onde.querySelector("[data-erro]");
    const botaoGerar = onde.querySelector("[data-gerar]");
    const caixaResultado = onde.querySelector("[data-resultado]");

    function avisarErro(texto) {
        caixaErro.textContent = texto || "";
        caixaErro.hidden = !texto;
    }

    function desenharEscolha() {
        caixaPlanos.innerHTML = Object.keys(PLANOS).map((id) => `
            <button type="button" class="plano-pagar${id === plano ? " escolhido" : ""}"
                    data-plano="${esc(id)}" aria-pressed="${id === plano}">
                <strong>${esc(PLANOS[id].nome)}</strong>
                <span>${esc(PLANOS[id].valor)}</span>
                <small>${esc(PLANOS[id].resumo)}</small>
            </button>
        `).join("");

        botaoGerar.disabled = false;
        botaoGerar.textContent = "Gerar Pix de " + dinheiro(planoOu(plano).preco);
    }

    function voltarAEscolha(erro) {
        pagamentoEmEspera = null;
        caixaResultado.hidden = true;
        caixaResultado.innerHTML = "";
        caixaEscolha.hidden = false;
        desenharEscolha();
        avisarErro(erro);
    }


    /* ---------- a cobrança ---------- */

    async function gerarPix() {
        avisarErro("");
        botaoGerar.disabled = true;
        botaoGerar.textContent = "Gerando o Pix...";

        const { data, error } = await conectar().functions.invoke("pagar-assinatura", {
            body: { plano }
        });

        let r = data;
        if (error) {
            try {
                r = await error.context.json();
            } catch (_) {
                r = null;
            }
        }

        if (!r || r.erro) {
            voltarAEscolha((r && r.erro) || "Não foi possível gerar o Pix. Tente de novo em instantes.");
            return;
        }

        if (r.aprovado) {
            mostrarAprovado(r.vencimento);
            return;
        }

        mostrarPix(r);
    }

    function mostrarPix(r) {
        caixaEscolha.hidden = true;
        caixaResultado.hidden = false;

        caixaResultado.innerHTML = `
            <div class="resultado-pix">
                <p class="explica">
                    Abra o aplicativo do seu banco, escolha Pix e leia o código,
                    ou copie o código abaixo.
                </p>
                ${r.pixQrBase64 ? `<img class="qr-pix" alt="QR Code do Pix" src="data:image/png;base64,${esc(r.pixQrBase64)}">` : ""}
                <p class="valor-pix">
                    ${esc(planoOu(plano).nome)}: <strong>${esc(dinheiro(planoOu(plano).preco))}</strong>
                </p>
                ${r.pixCopiaECola ? `
                    <label class="rotulo-copia" for="copia-${idCaixa}">Pix copia e cola</label>
                    <div class="copia-cola">
                        <input type="text" id="copia-${idCaixa}" readonly value="${esc(r.pixCopiaECola)}">
                        <button type="button" class="botao-vazio botao-miudo" data-copiar>Copiar</button>
                    </div>` : ""}
                <p class="esperando" data-esperando>
                    Aguardando o pagamento. A revenda é liberada sozinha assim que o Pix cair.
                </p>
                <button type="button" class="botao-vazio" data-trocar>Trocar de plano</button>
            </div>`;

        esperar(r.pagamento);
    }

    function mostrarAprovado(vencimento) {
        pagamentoEmEspera = null;
        caixaEscolha.hidden = true;
        caixaResultado.hidden = false;

        const ate = dataDoVencimento(vencimento);

        caixaResultado.innerHTML = `
            <div class="resultado-aprovado">
                <strong>Pagamento recebido</strong>
                <p>
                    A sua revenda está liberada${ate ? " até " + esc(ate) : ""}.
                    ${opcoes.aoPagar ? "" : "Entre no painel e cadastre os preços para aparecer na busca."}
                </p>
                ${opcoes.aoPagar ? "" : `<a class="botao" href="painel.html">Abrir o painel</a>`}
            </div>`;

        if (opcoes.aoPagar) opcoes.aoPagar({ vencimento });
    }


    /* ---------- esperando o Pix cair ---------- */

    function esperar(pagamentoId) {
        if (!pagamentoId) return;

        pagamentoEmEspera = pagamentoId;
        const inicio = Date.now();

        const conferir = async () => {
            // Trocou de plano, ou a pessoa saiu da tela.
            if (pagamentoEmEspera !== pagamentoId || !document.body.contains(onde)) return;

            const { data } = await conectar()
                .from("pagamentos")
                .select("status, creditado_em, vencimento_depois")
                .eq("id", pagamentoId)
                .maybeSingle();

            if (pagamentoEmEspera !== pagamentoId) return;

            if (data && data.status === "pago" && data.creditado_em) {
                mostrarAprovado(data.vencimento_depois);
                return;
            }

            if (data && (data.status === "cancelado" || data.status === "estornado")) {
                voltarAEscolha("O Pix expirou ou foi cancelado. Gere outro.");
                return;
            }

            if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
                const aviso = caixaResultado.querySelector("[data-esperando]");
                if (aviso) aviso.textContent = "Já pagou? Recarregue a página em alguns minutos para ver a revenda liberada.";
                return;
            }

            setTimeout(conferir, INTERVALO_ESPERA_MS);
        };

        setTimeout(conferir, INTERVALO_ESPERA_MS);
    }


    /* ---------- os cliques ---------- */

    // Um ouvinte só, na caixa: o conteúdo é redesenhado, e ouvintes
    // presos aos botões iriam embora junto.
    onde.onclick = async (evento) => {
        const botaoPlano = evento.target.closest("[data-plano]");
        if (botaoPlano) {
            plano = botaoPlano.dataset.plano;
            avisarErro("");
            desenharEscolha();
            return;
        }

        if (evento.target.closest("[data-gerar]")) {
            gerarPix();
            return;
        }

        // O QR antigo continua pagável por 24 horas. Se a pessoa pagar
        // os dois, o segundo também vale: o prazo soma.
        if (evento.target.closest("[data-trocar]")) {
            voltarAEscolha("");
            return;
        }

        const copiar = evento.target.closest("[data-copiar]");
        if (copiar) {
            const campo = onde.querySelector(".copia-cola input");
            try {
                await navigator.clipboard.writeText(campo.value);
            } catch (e) {
                // Sem permissão de área de transferência: seleciona o
                // texto, e a pessoa copia com o dedo.
                campo.select();
                document.execCommand("copy");
            }
            copiar.textContent = "Copiado!";
            setTimeout(() => { copiar.textContent = "Copiar"; }, 2000);
        }
    };

    desenharEscolha();
}


/** O recado para quem está com a revenda bloqueada pelo administrador. */
function desenharBloqueio(onde, revenda) {
    const texto = "Olá! A revenda *" + (revenda.nome || "") + "* está bloqueada no Achei Água & Gás. Pode me ajudar?";

    onde.innerHTML = `
        <div class="pagar">
            <h3>Fale com a gente</h3>
            <p class="explica">
                Esta revenda foi bloqueada, e o pagamento não libera sozinho.
                Chame no WhatsApp para resolver.
            </p>
            <a class="botao botao-zap" target="_blank" rel="noopener"
               href="https://wa.me/${esc(numeroDeZap(SUPORTE.whatsapp))}?text=${encodeURIComponent(texto)}">
                Chamar no WhatsApp
            </a>
        </div>`;
    onde.hidden = false;
}
