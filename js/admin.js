// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: admin.js
// Versão: 1.0
// ==========================================

/*
   A tela de ativar revenda, para usar no celular.

   O caminho de quem paga: Pix -> comprovante no WhatsApp -> você abre
   esta página, confere o nome e aperta Ativar. A revenda entra na busca
   na hora.

   O que esta tela NÃO faz: proteger nada. Quem protege é o banco. As
   três funções que ela chama conferem, na primeira linha, se quem
   pediu está na tabela `administradores` (veja 006-admin.sql). Sem
   isso, chamar a função do console do navegador não devolve nada.

   Precisa de: utils.js (esc, dinheiro não, mas esc e numeroDeZap) e
   banco.js (conectar).
*/

const PLANOS_ADMIN = {
    mensal: { nome: "Mensal", prazo: "1 mês" },
    anual: { nome: "Anual", prazo: "12 meses" }
};

let pendentes = [];
const ativadasAgora = [];


/* ==========================================
   RECADOS
========================================== */

function avisar(texto, tipo) {
    const recado = document.getElementById("recado");
    recado.textContent = texto || "";
    recado.hidden = !texto;
    recado.className = "recado" + (tipo ? " " + tipo : "");
    if (texto) window.scrollTo({ top: 0, behavior: "smooth" });
}


/* ==========================================
   ENTRAR E SAIR
========================================== */

function mostrarEntrar() {
    document.getElementById("bloco-entrar").hidden = false;
    document.getElementById("bloco-lista").hidden = true;
    document.getElementById("botao-sair").hidden = true;
    document.getElementById("quem-sou").textContent = "";
}

async function sairDaConta() {
    const banco = conectar();
    if (banco) await banco.auth.signOut();
    pendentes = [];
    ativadasAgora.length = 0;
    document.getElementById("ativadas").innerHTML = "";
    document.getElementById("bloco-ativadas").hidden = true;
    avisar("");
    mostrarEntrar();
}


document.getElementById("form-entrar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const banco = conectar();
    if (!banco) return avisar("O sistema está sem conexão com o banco.", "erro");

    const botao = document.getElementById("botao-entrar");
    botao.disabled = true;
    botao.textContent = "Entrando...";
    avisar("");

    const { error } = await banco.auth.signInWithPassword({
        email: document.getElementById("email").value.trim().toLowerCase(),
        password: document.getElementById("senha").value
    });

    botao.disabled = false;
    botao.textContent = "Entrar";

    if (error) {
        avisar(error.status === 429 ? "Muitas tentativas seguidas. Espere um minuto." : "E-mail ou senha não conferem.", "erro");
        return;
    }

    document.getElementById("senha").value = "";
    await carregar();
});


document.getElementById("botao-sair").addEventListener("click", sairDaConta);
document.getElementById("botao-atualizar").addEventListener("click", () => carregar());

document.querySelectorAll("[data-ver-senha]").forEach((botao) => {
    botao.addEventListener("click", () => {
        const campo = document.getElementById(botao.dataset.verSenha);
        const escondida = campo.type === "password";
        campo.type = escondida ? "text" : "password";
        botao.textContent = escondida ? "Esconder" : "Mostrar";
    });
});


/* ==========================================
   A LISTA
========================================== */

/** "1 hora atrás", "ontem", "há 3 dias" — quem espera há muito aparece. */
function esperaEscrita(quando) {
    const dias = Math.floor((Date.now() - new Date(quando).getTime()) / 86400000);
    if (dias <= 0) return "hoje";
    if (dias === 1) return "ontem";
    return "há " + dias + " dias";
}

function cnpjEscrito(cnpj) {
    return String(cnpj || "")
        .replace(/\D/g, "")
        .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function cartao(r) {
    const suspensa = r.assinatura_status === "suspensa";
    const plano = PLANOS_ADMIN[r.plano] ? r.plano : "anual";
    const zap = numeroDeZap(r.whatsapp);

    return `
        <article class="revenda" data-revenda="${esc(r.id)}">
            <span class="${suspensa ? "selo-suspensa" : "selo-espera"}">
                ${suspensa ? "SUSPENSA" : "AGUARDANDO PAGAMENTO"}
            </span>
            <h2>${esc(r.nome)}</h2>
            <p class="linha">CNPJ <strong>${esc(cnpjEscrito(r.cnpj))}</strong></p>
            <p class="linha">${esc(r.endereco_texto || "")}${r.cidade || r.uf
                ? ` · <strong>${esc([r.cidade, r.uf].filter(Boolean).join("/"))}</strong>`
                : ""}</p>
            <p class="linha">Cadastrou ${esc(esperaEscrita(r.criado_em))}</p>

            <div class="escolha-plano" role="group" aria-label="Plano pago">
                ${Object.keys(PLANOS_ADMIN).map((id) => `
                    <label>
                        <input type="radio" name="plano-${esc(r.id)}" value="${esc(id)}"
                               ${id === plano ? "checked" : ""}>
                        ${esc(PLANOS_ADMIN[id].nome)} · ${esc(PLANOS_ADMIN[id].prazo)}
                    </label>
                `).join("")}
            </div>

            <button type="button" class="botao" data-ativar="${esc(r.id)}">Ativar revenda</button>

            <div class="acoes-linha">
                ${zap ? `<a class="botao-vazio botao-miudo" target="_blank" rel="noopener"
                            href="https://wa.me/${esc(zap)}">Falar no WhatsApp</a>` : ""}
                ${r.telefone_responsavel ? `<a class="botao-vazio botao-miudo"
                            href="tel:${esc(r.telefone_responsavel)}">Ligar para o responsável</a>` : ""}
            </div>
        </article>`;
}

function desenharLista() {
    const area = document.getElementById("lista");

    if (!pendentes.length) {
        area.innerHTML = `<p class="vazio">Nenhuma revenda esperando.<br>Quando alguém pagar, ela aparece aqui.</p>`;
        return;
    }

    area.innerHTML = pendentes.map(cartao).join("");
}


async function carregar() {
    const banco = conectar();
    if (!banco) return avisar("O sistema está sem conexão com o banco.", "erro");

    const { data: sessao } = await banco.auth.getSession();
    if (!sessao || !sessao.session) return mostrarEntrar();

    document.getElementById("lista").innerHTML = `<p class="vazio">Carregando...</p>`;
    document.getElementById("bloco-entrar").hidden = true;
    document.getElementById("bloco-lista").hidden = false;
    document.getElementById("botao-sair").hidden = false;
    document.getElementById("quem-sou").textContent = sessao.session.user.email;

    const { data, error } = await banco.rpc("revendas_pendentes");

    if (error) {
        // A função recusa quem não é administrador. Aqui é o único lugar
        // que a pessoa descobre isso, então a frase precisa dizer o que
        // fazer, e não só que deu errado.
        document.getElementById("bloco-lista").hidden = true;
        avisar(
            "Esta conta entrou, mas não é administradora. Rode o cadastro de administrador "
            + "do arquivo supabase/006-admin.sql com este e-mail: " + sessao.session.user.email,
            "erro"
        );
        return;
    }

    pendentes = data || [];
    avisar("");
    desenharLista();
}


/* ==========================================
   ATIVAR E DESFAZER
========================================== */

document.getElementById("lista").addEventListener("click", async (evento) => {
    const botao = evento.target.closest("[data-ativar]");
    if (!botao) return;

    const id = botao.dataset.ativar;
    const revenda = pendentes.find((r) => r.id === id);
    if (!revenda) return;

    const escolhido = document.querySelector(`input[name="plano-${CSS.escape(id)}"]:checked`);
    const plano = escolhido ? escolhido.value : revenda.plano;

    // Pergunta antes: o dedo escorrega, e ativar sem pagamento é dinheiro
    // que não entra. O nome vai na pergunta para conferir quem é.
    const certeza = confirm(
        `Ativar ${revenda.nome}?\n\nPlano ${PLANOS_ADMIN[plano].nome}, ${PLANOS_ADMIN[plano].prazo}.\n`
        + "A revenda entra na busca na hora."
    );
    if (!certeza) return;

    botao.disabled = true;
    botao.textContent = "Ativando...";

    const banco = conectar();
    const { data, error } = await banco.rpc("ativar_revenda", { p_id: id, p_plano: plano });

    if (error) {
        botao.disabled = false;
        botao.textContent = "Ativar revenda";
        avisar("Não deu para ativar: " + error.message, "erro");
        return;
    }

    const linha = Array.isArray(data) ? data[0] : data;
    pendentes = pendentes.filter((r) => r.id !== id);
    ativadasAgora.unshift({
        id: id,
        nome: revenda.nome,
        vencimento: linha ? linha.assinatura_vencimento : null
    });

    desenharLista();
    desenharAtivadas();
    avisar(revenda.nome + " está no ar.", "ok");
});


function desenharAtivadas() {
    const bloco = document.getElementById("bloco-ativadas");
    const area = document.getElementById("ativadas");

    bloco.hidden = ativadasAgora.length === 0;
    area.innerHTML = ativadasAgora.map((a) => `
        <div class="ativada">
            <span>${esc(a.nome)}${a.vencimento ? " · vence " + esc(dataEscrita(a.vencimento)) : ""}</span>
            <button type="button" class="botao-vazio botao-miudo" data-desfazer="${esc(a.id)}">Desfazer</button>
        </div>`).join("");
}


/** "2026-10-15" vira "15/10/2026". Sem Date: fuso horário aqui só atrapalha. */
function dataEscrita(iso) {
    const partes = String(iso || "").slice(0, 10).split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "";
}


document.getElementById("ativadas").addEventListener("click", async (evento) => {
    const botao = evento.target.closest("[data-desfazer]");
    if (!botao) return;

    const id = botao.dataset.desfazer;
    const ativada = ativadasAgora.find((a) => a.id === id);
    if (!ativada) return;

    if (!confirm(`Desfazer a ativação de ${ativada.nome}?\n\nEla sai da busca na hora.`)) return;

    botao.disabled = true;
    botao.textContent = "...";

    const banco = conectar();
    const { error } = await banco.rpc("desfazer_ativacao", { p_id: id });

    if (error) {
        botao.disabled = false;
        botao.textContent = "Desfazer";
        avisar("Não deu para desfazer: " + error.message, "erro");
        return;
    }

    const posicao = ativadasAgora.findIndex((a) => a.id === id);
    if (posicao >= 0) ativadasAgora.splice(posicao, 1);

    desenharAtivadas();
    avisar(ativada.nome + " voltou para a lista de espera.", "ok");
    await carregar();
});


/* ==========================================
   COMEÇO
========================================== */

carregar();
