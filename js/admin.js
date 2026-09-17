// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: admin.js
// Versão: 2.0
// ==========================================

/*
   O painel do administrador, para usar no celular.

   Todas as revendas, de qualquer situação, com filtro e busca. Em cada
   uma: ver preços e horários, editar os dados, liberar, bloquear,
   cancelar, apagar, e falar com o dono.

   O que esta tela NÃO faz: proteger nada. Quem protege é o banco. Cada
   função que ela chama confere, na primeira linha, se quem pediu está
   na tabela `administradores` (006-admin.sql e 009-admin-completo.sql).
   Chamada do console por quem não é administrador não devolve nada.

   Precisa de: utils.js (esc, dinheiro, numeroDeZap), banco.js
   (conectar) e estados.js (o select de estado da edição).
*/

const PLANOS_ADMIN = {
    mensal: { nome: "Mensal", prazo: "1 mês" },
    anual: { nome: "Anual", prazo: "12 meses" }
};

const SITUACOES = {
    aguardando_pagamento: { nome: "Aguardando pagamento", curto: "Aguardando" },
    ativa:                { nome: "Ativa", curto: "Ativas" },
    suspensa:             { nome: "Bloqueada", curto: "Bloqueadas" },
    cancelada:            { nome: "Cancelada", curto: "Canceladas" }
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const estado = {
    revendas: [],
    filtro: "todas",
    busca: "",
    // Uma revenda aberta de cada vez, para ver ou para editar.
    aberta: null,       // id
    modo: null,         // "detalhe" ou "editar"
    detalhes: {}        // id -> { precos, horarios }
};


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

function erroDoBanco(error) {
    return (error && (error.message || error.details)) || "erro desconhecido";
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
    estado.revendas = [];
    estado.aberta = null;
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
   CARREGAR
========================================== */

async function carregar() {
    const banco = conectar();
    if (!banco) return avisar("O sistema está sem conexão com o banco.", "erro");

    const { data: sessao } = await banco.auth.getSession();
    if (!sessao || !sessao.session) return mostrarEntrar();

    document.getElementById("lista").innerHTML = `<p class="vazio">Carregando...</p>`;
    document.getElementById("bloco-entrar").hidden = true;
    document.getElementById("bloco-lista").hidden = false;
    document.getElementById("botao-sair").hidden = false;
    document.getElementById("quem-sou").textContent = "Entrou como " + sessao.session.user.email;

    const { data, error } = await banco.rpc("admin_revendas");

    if (error) {
        // A função recusa quem não é administrador. Aqui é o único lugar
        // em que a pessoa descobre isso.
        document.getElementById("bloco-lista").hidden = true;
        avisar("Esta conta entrou, mas não é administradora: " + sessao.session.user.email, "erro");
        return;
    }

    estado.revendas = data || [];
    estado.detalhes = {};
    desenhar();
}


/* ==========================================
   A LISTA
========================================== */

function cnpjEscrito(cnpj) {
    return String(cnpj || "")
        .replace(/\D/g, "")
        .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** "2026-10-15" vira "15/10/2026". Sem Date: fuso horário aqui só atrapalha. */
function dataEscrita(iso) {
    const partes = String(iso || "").slice(0, 10).split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "";
}

function telefoneEscrito(so) {
    const n = String(so || "").replace(/\D/g, "");
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return n;
}

function semAcento(texto) {
    return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function visiveis() {
    const termo = semAcento(estado.busca.trim());
    const soNumeros = estado.busca.replace(/\D/g, "");

    return estado.revendas.filter((r) => {
        if (estado.filtro !== "todas" && r.assinatura_status !== estado.filtro) return false;
        if (!termo) return true;

        const texto = semAcento([r.nome, r.cidade, r.uf, r.email, r.responsavel, r.endereco_texto].join(" "));
        return texto.includes(termo) || (soNumeros.length >= 3 && String(r.cnpj).includes(soNumeros));
    });
}


function desenharFiltros() {
    const contar = (s) => estado.revendas.filter((r) => r.assinatura_status === s).length;

    const opcoes = [{ id: "todas", nome: "Todas", total: estado.revendas.length }]
        .concat(Object.keys(SITUACOES).map((s) => ({ id: s, nome: SITUACOES[s].curto, total: contar(s) })));

    document.getElementById("filtros").innerHTML = opcoes.map((o) => `
        <button type="button" class="filtro${estado.filtro === o.id ? " escolhido" : ""}" data-filtro="${esc(o.id)}">
            ${esc(o.nome)} <span>${o.total}</span>
        </button>`).join("");
}


function desenhar() {
    desenharFiltros();

    const area = document.getElementById("lista");
    const lista = visiveis();

    if (!estado.revendas.length) {
        area.innerHTML = `<p class="vazio">Nenhuma revenda cadastrada ainda.<br>Quando alguém se cadastrar, ela aparece aqui.</p>`;
        return;
    }

    if (!lista.length) {
        area.innerHTML = `<p class="vazio">Nenhuma revenda com esse filtro.</p>`;
        return;
    }

    area.innerHTML = lista.map(cartao).join("");
    prepararEdicao();
}


function cartao(r) {
    const situacao = SITUACOES[r.assinatura_status] || { nome: r.assinatura_status };
    const zap = numeroDeZap(r.whatsapp);
    const aberta = estado.aberta === r.id;
    const lugar = [r.cidade, r.uf].filter(Boolean).join("/");

    return `
        <article class="revenda" data-revenda="${esc(r.id)}">
            <span class="selo ${esc(r.assinatura_status)}">${esc(situacao.nome.toUpperCase())}</span>
            <h2>${esc(r.nome)}</h2>
            <p class="linha">${lugar ? `<strong>${esc(lugar)}</strong> · ` : ""}CNPJ ${esc(cnpjEscrito(r.cnpj))}</p>
            <p class="linha">${esc(r.endereco_texto || "")}</p>
            <p class="linha">
                Plano <strong>${esc((PLANOS_ADMIN[r.plano] || { nome: r.plano }).nome)}</strong>
                ${r.assinatura_vencimento ? ` · vence <strong>${esc(dataEscrita(r.assinatura_vencimento))}</strong>` : ""}
                · ${r.itens_com_preco} ${r.itens_com_preco === 1 ? "item" : "itens"} com preço
            </p>
            <p class="linha">
                Dono: <strong>${esc(r.responsavel || "—")}</strong>${r.email ? ` · ${esc(r.email)}` : ""}
                · cadastrou em ${esc(dataEscrita(r.criado_em))}
            </p>

            ${(r.extras || []).length
                ? `<p class="linha">Também vende: ${extrasDe(r.extras).map((e) => esc(e.curto) + seloMaiores(e)).join(", ")}</p>`
                : ""}

            ${acoesDaSituacao(r)}

            <div class="grupo-botoes">
                ${zap ? `<a class="botao-vazio botao-miudo" target="_blank" rel="noopener" href="https://wa.me/${esc(zap)}">WhatsApp ${esc(telefoneEscrito(r.whatsapp))}</a>` : ""}
                ${r.telefone_responsavel ? `<a class="botao-vazio botao-miudo" href="tel:+55${esc(r.telefone_responsavel)}">Ligar para o dono</a>` : ""}
                ${r.email ? `<a class="botao-vazio botao-miudo" href="mailto:${esc(r.email)}">E-mail</a>` : ""}
                <a class="botao-vazio botao-miudo" target="_blank" rel="noopener"
                   href="https://www.google.com/maps/search/?api=1&query=${esc(r.latitude)},${esc(r.longitude)}">Ver no mapa</a>
            </div>

            <div class="grupo-botoes">
                <button type="button" class="botao-vazio botao-miudo" data-acao="detalhe">${aberta && estado.modo === "detalhe" ? "Fechar detalhes" : "Ver preços e horários"}</button>
                <button type="button" class="botao-vazio botao-miudo" data-acao="editar">${aberta && estado.modo === "editar" ? "Fechar edição" : "Editar dados"}</button>
                <button type="button" class="botao-vazio botao-miudo botao-perigo" data-acao="apagar">Apagar</button>
            </div>

            ${aberta ? `<div class="painel-extra">${estado.modo === "editar" ? formularioEdicao(r) : detalheDe(r)}</div>` : ""}
        </article>`;
}


/**
 * Os botões que mudam a situação. Liberar só aparece para quem não
 * está no ar, e bloquear só para quem está.
 */
function acoesDaSituacao(r) {
    const plano = PLANOS_ADMIN[r.plano] ? r.plano : "anual";

    if (r.assinatura_status === "ativa") {
        return `
            <div class="grupo-botoes">
                <button type="button" class="botao botao-bloquear" data-acao="bloquear">Bloquear</button>
                <button type="button" class="botao-vazio" data-acao="renovar">Renovar plano</button>
            </div>
            ${escolhaDePlano(r, plano)}`;
    }

    return `
        ${escolhaDePlano(r, plano)}
        <div class="grupo-botoes">
            <button type="button" class="botao" data-acao="liberar">Liberar</button>
            ${r.assinatura_status !== "cancelada" ? `<button type="button" class="botao-vazio" data-acao="cancelar">Cancelar</button>` : ""}
            ${r.assinatura_status !== "aguardando_pagamento" ? `<button type="button" class="botao-vazio" data-acao="aguardar">Voltar a aguardar pagamento</button>` : ""}
        </div>`;
}

function escolhaDePlano(r, plano) {
    return `
        <div class="escolha-plano" role="group" aria-label="Plano pago">
            ${Object.keys(PLANOS_ADMIN).map((id) => `
                <label>
                    <input type="radio" name="plano-${esc(r.id)}" value="${esc(id)}" ${id === plano ? "checked" : ""}>
                    ${esc(PLANOS_ADMIN[id].nome)} · ${esc(PLANOS_ADMIN[id].prazo)}
                </label>`).join("")}
        </div>`;
}


/* ==========================================
   DETALHES
========================================== */

function detalheDe(r) {
    const d = estado.detalhes[r.id];
    if (!d) return `<p class="linha">Carregando...</p>`;

    const precos = d.precos.length
        ? `<table class="tabela-mini">${d.precos.map((p) => `
            <tr class="${p.disponivel ? "" : "apagado"}">
                <td>${esc(p.item)}${p.disponivel ? "" : " (em falta)"}</td>
                <td>${esc(dinheiro(p.preco))}</td>
            </tr>`).join("")}</table>`
        : `<p class="linha">Nenhum preço cadastrado. Sem preço, a revenda não aparece na busca.</p>`;

    const faixa = (tipo) => d.horarios
        .filter((h) => h.tipo === tipo)
        .map((h) => `<tr><td>${DIAS[h.dia]}</td><td>${h.fechado ? "fechado" : esc(h.abre + " às " + h.fecha)}</td></tr>`)
        .join("");

    return `
        <p class="linha">
            ${r.faz_entrega ? `Entrega até <strong>${esc(r.raio_entrega_km)} km</strong>, taxa <strong>${esc(Number(r.taxa_entrega) ? dinheiro(r.taxa_entrega) : "grátis")}</strong>` : "Não entrega"}
            · ${r.faz_retirada ? "atende no balcão" : "não atende no balcão"}
        </p>
        <h3>Preços</h3>
        ${precos}
        <div class="duas-colunas">
            <div><h3>Entrega</h3><table class="tabela-mini">${faixa("entrega") || "<tr><td>—</td></tr>"}</table></div>
            <div><h3>Balcão</h3><table class="tabela-mini">${faixa("retirada") || "<tr><td>—</td></tr>"}</table></div>
        </div>`;
}

async function abrirDetalhe(id) {
    const { data, error } = await conectar().rpc("admin_detalhe", { p_id: id });
    if (error) {
        avisar("Não deu para abrir os detalhes: " + erroDoBanco(error), "erro");
        return;
    }
    estado.detalhes[id] = data || { precos: [], horarios: [] };
    if (estado.aberta === id) desenhar();
}


/* ==========================================
   EDITAR
========================================== */

function formularioEdicao(r) {
    const campo = (id, rotulo, valor, extra = "") => `
        <div class="campo">
            <label for="ed-${id}">${rotulo}</label>
            <input id="ed-${id}" value="${esc(valor ?? "")}" ${extra}>
        </div>`;

    return `
        <form data-editar="${esc(r.id)}">
            ${campo("nome", "Nome da revenda", r.nome)}
            ${campo("responsavel", "Nome do dono", r.responsavel)}
            <div class="duas-colunas">
                ${campo("whatsapp", "WhatsApp dos pedidos", r.whatsapp, 'inputmode="numeric"')}
                ${campo("telefone_responsavel", "Telefone do dono", r.telefone_responsavel, 'inputmode="numeric"')}
            </div>
            ${campo("endereco_texto", "Endereço, como aparece na lista", r.endereco_texto)}
            <div class="duas-colunas">
                ${campo("cidade", "Cidade", r.cidade)}
                <div class="campo">
                    <label for="ed-uf">Estado</label>
                    <select id="ed-uf" data-uf="${esc(r.uf || "")}"></select>
                </div>
            </div>
            <div class="duas-colunas">
                ${campo("raio_entrega_km", "Raio de entrega (km)", r.raio_entrega_km, 'type="number" min="0.5" max="60" step="0.5"')}
                ${campo("taxa_entrega", "Taxa de entrega (R$)", r.taxa_entrega, 'type="number" min="0" step="0.5"')}
            </div>
            <label class="marcar"><input type="checkbox" id="ed-faz_entrega" ${r.faz_entrega ? "checked" : ""}> Faz entrega</label>
            <label class="marcar"><input type="checkbox" id="ed-faz_retirada" ${r.faz_retirada ? "checked" : ""}> Atende no balcão</label>
            <div class="duas-colunas">
                <div class="campo">
                    <label for="ed-plano">Plano</label>
                    <select id="ed-plano">
                        ${Object.keys(PLANOS_ADMIN).map((id) => `<option value="${id}" ${r.plano === id ? "selected" : ""}>${PLANOS_ADMIN[id].nome}</option>`).join("")}
                    </select>
                </div>
                ${campo("assinatura_vencimento", "Vencimento", r.assinatura_vencimento, 'type="date"')}
            </div>
            <p class="linha">O CNPJ e o ponto no mapa não mudam por aqui.</p>
            <div class="grupo-botoes">
                <button type="submit" class="botao">Salvar alterações</button>
            </div>
        </form>`;
}

/** Depois de desenhar, o select de estado ganha as opções e o valor. */
function prepararEdicao() {
    const select = document.getElementById("ed-uf");
    if (!select) return;
    opcoesDeEstado(select, "—", false);
    select.value = select.dataset.uf;
}

async function salvarEdicao(form) {
    const id = form.dataset.editar;
    const valor = (campo) => document.getElementById("ed-" + campo).value.trim();

    const dados = {
        nome: valor("nome"),
        responsavel: valor("responsavel"),
        whatsapp: valor("whatsapp"),
        telefone_responsavel: valor("telefone_responsavel"),
        endereco_texto: valor("endereco_texto"),
        cidade: valor("cidade"),
        uf: valor("uf"),
        raio_entrega_km: Number(valor("raio_entrega_km")),
        taxa_entrega: Number(valor("taxa_entrega") || 0),
        faz_entrega: document.getElementById("ed-faz_entrega").checked,
        faz_retirada: document.getElementById("ed-faz_retirada").checked,
        plano: valor("plano"),
        assinatura_vencimento: valor("assinatura_vencimento")
    };

    if (dados.nome.length < 3) return avisar("O nome precisa ter pelo menos 3 letras.", "erro");
    const zap = dados.whatsapp.replace(/\D/g, "");
    if (zap.length !== 10 && zap.length !== 11) return avisar("O WhatsApp precisa ter o DDD e o número.", "erro");
    if (!dados.faz_entrega && !dados.faz_retirada) return avisar("A revenda precisa entregar, atender no balcão, ou os dois.", "erro");
    if (!(dados.raio_entrega_km > 0 && dados.raio_entrega_km <= 60)) return avisar("O raio de entrega vai de 0,5 a 60 km.", "erro");

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const { error } = await conectar().rpc("admin_editar_revenda", { p_id: id, p_dados: dados });

    if (error) {
        botao.disabled = false;
        botao.textContent = "Salvar alterações";
        avisar("Não deu para salvar: " + erroDoBanco(error), "erro");
        return;
    }

    estado.aberta = null;
    await carregar();
    avisar("Dados de " + dados.nome + " salvos.", "ok");
}


/* ==========================================
   AÇÕES
========================================== */

function planoEscolhido(r) {
    const marcado = document.querySelector(`input[name="plano-${CSS.escape(r.id)}"]:checked`);
    return marcado ? marcado.value : (PLANOS_ADMIN[r.plano] ? r.plano : "anual");
}

async function executar(botao, rotulo, chamada, sucesso) {
    botao.disabled = true;
    const antes = botao.textContent;
    botao.textContent = rotulo;

    const { error } = await chamada();

    if (error) {
        botao.disabled = false;
        botao.textContent = antes;
        avisar("Não deu certo: " + erroDoBanco(error), "erro");
        return;
    }

    await carregar();
    avisar(sucesso, "ok");
}

async function agir(botao, r, acao) {
    const banco = conectar();

    if (acao === "liberar" || acao === "renovar") {
        const plano = planoEscolhido(r);
        const pergunta = acao === "liberar"
            ? `Liberar ${r.nome}?\n\nPlano ${PLANOS_ADMIN[plano].nome}, ${PLANOS_ADMIN[plano].prazo}. A revenda entra na busca na hora.`
            : `Renovar ${r.nome} por mais ${PLANOS_ADMIN[plano].prazo}?\n\nO prazo conta a partir do vencimento atual.`;
        if (!confirm(pergunta)) return;

        return executar(botao, "Liberando...",
            () => banco.rpc("ativar_revenda", { p_id: r.id, p_plano: plano }),
            acao === "liberar" ? r.nome + " está no ar." : r.nome + " renovada.");
    }

    if (acao === "bloquear") {
        if (!confirm(`Bloquear ${r.nome}?\n\nEla sai da busca na hora. Dá para liberar de novo depois.`)) return;
        return executar(botao, "Bloqueando...",
            () => banco.rpc("admin_mudar_situacao", { p_id: r.id, p_status: "suspensa" }),
            r.nome + " foi bloqueada.");
    }

    if (acao === "cancelar") {
        if (!confirm(`Cancelar ${r.nome}?\n\nEla fica fora da busca. Os dados continuam guardados.`)) return;
        return executar(botao, "Cancelando...",
            () => banco.rpc("admin_mudar_situacao", { p_id: r.id, p_status: "cancelada" }),
            r.nome + " foi cancelada.");
    }

    if (acao === "aguardar") {
        if (!confirm(`Voltar ${r.nome} para aguardando pagamento?`)) return;
        return executar(botao, "...",
            () => banco.rpc("admin_mudar_situacao", { p_id: r.id, p_status: "aguardando_pagamento" }),
            r.nome + " voltou a aguardar pagamento.");
    }

    if (acao === "apagar") {
        // Duas travas: a confirmação e o nome digitado. Apagar leva junto
        // preços, horários e o acesso do dono, e não tem volta.
        if (!confirm(`APAGAR ${r.nome} de vez?\n\nSaem também os preços, os horários e o acesso do dono. Não tem volta.`)) return;
        const digitado = prompt(`Para confirmar, digite o nome da revenda:\n\n${r.nome}`);
        if (digitado === null) return;
        if (digitado.trim().toLowerCase() !== r.nome.trim().toLowerCase()) {
            avisar("O nome digitado não confere. Nada foi apagado.", "erro");
            return;
        }
        return executar(botao, "Apagando...",
            () => banco.rpc("admin_apagar_revenda", { p_id: r.id }),
            r.nome + " foi apagada.");
    }

    if (acao === "detalhe" || acao === "editar") {
        const fechando = estado.aberta === r.id && estado.modo === acao;
        estado.aberta = fechando ? null : r.id;
        estado.modo = fechando ? null : acao;
        desenhar();
        if (!fechando && acao === "detalhe" && !estado.detalhes[r.id]) abrirDetalhe(r.id);
    }
}


document.getElementById("lista").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-acao]");
    if (!botao) return;

    const cartaoEl = botao.closest("[data-revenda]");
    const r = estado.revendas.find((x) => x.id === cartaoEl.dataset.revenda);
    if (r) agir(botao, r, botao.dataset.acao);
});

document.getElementById("lista").addEventListener("submit", (evento) => {
    const form = evento.target.closest("[data-editar]");
    if (!form) return;
    evento.preventDefault();
    salvarEdicao(form);
});

document.getElementById("filtros").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-filtro]");
    if (!botao) return;
    estado.filtro = botao.dataset.filtro;
    desenhar();
});

document.getElementById("busca").addEventListener("input", (evento) => {
    estado.busca = evento.target.value;
    desenhar();
});


/* ==========================================
   COMEÇO
========================================== */

carregar();
