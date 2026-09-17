// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: painel.js
// Versão: 1.0
// ==========================================

/*
   O painel da revenda.

   Quatro abas, e cada uma responde a uma pergunta que o dono faz:

     Preços    — quanto eu cobro por cada coisa
     Horários  — quando eu estou aberto
     Entrega   — eu levo, ou o cliente busca, e até onde
     A revenda — nome, logo, WhatsApp, endereço

   Preços vem primeiro de propósito. É o que faz a revenda aparecer na
   busca: sem preço nenhum cadastrado, ela não entra em resultado
   algum, por mais perto que esteja. É também o que muda toda semana.

   No topo, acima das abas, fica o aviso da assinatura, com a data do
   próximo pagamento. Não existe interruptor de pôr no ar: quem pagou
   aparece, e vencido some. Um botão a mais era um jeito de o dono ficar
   invisível sem perceber.

   Quem protege os dados é o RLS, no banco. Esta tela só mostra e
   escreve; se alguém a burlar, continua sem tocar em revenda alheia.
*/

let sessao = null;      // { usuario, revenda }
let revenda = null;     // a linha inteira da revenda
let catalogo = [];
let precos = [];
let horarios = [];

let abaAtual = "precos";


const ABAS = [
    { id: "precos",   nome: "Preços" },
    { id: "horarios", nome: "Horários" },
    { id: "entrega",  nome: "Entrega e pagamento" },
    { id: "revenda",  nome: "A revenda" }
];

// As formas de pagamento que o banco conhece, na ordem da tela. As
// chaves são as mesmas da coluna revendas.pagamentos.
const FORMAS_DE_PAGAMENTO = [
    { id: "pix",      nome: "Pix" },
    { id: "debito",   nome: "Cartão de débito" },
    { id: "credito",  nome: "Cartão de crédito" },
    { id: "dinheiro", nome: "Dinheiro" }
];

// Domingo é 0, como no JavaScript e como no banco.
const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// A ORDEM EM QUE A TELA MOSTRA, que não é a ordem dos números. A semana
// se lê começando na segunda, e o domingo fecha. Trocar o número do dia
// para bater com a tela seria o caminho para o erro de um dia; então o
// número fica como está e só a ordem de exibição muda.
const ORDEM_NA_TELA = [1, 2, 3, 4, 5, 6, 0];


/* ==========================================
   RECADOS
========================================== */

let sumindo = null;

function avisar(texto, tipo) {
    const recado = document.getElementById("recado");
    recado.textContent = texto || "";
    recado.className = "recado" + (tipo === "erro" ? " erro" : "");
    recado.hidden = !texto;

    clearTimeout(sumindo);

    // O aviso de sucesso some sozinho. Deixado na tela, ele fica
    // dizendo "salvo" enquanto a pessoa já mexe em outra coisa, e ela
    // passa a não acreditar mais nele.
    if (texto && tipo !== "erro") {
        sumindo = setTimeout(() => { recado.hidden = true; }, 4000);
    }

    if (texto) window.scrollTo({ top: 0, behavior: "smooth" });
}


/* ==========================================
   CARREGAR
========================================== */

async function carregarTudo() {
    const banco = conectar();

    const [c, p, h, r] = await Promise.all([
        banco.from("itens").select("id, tipo, nome, apelido, ordem").eq("ativo", true).order("ordem"),
        banco.from("precos").select("id, item_id, preco, disponivel, atualizado_em"),
        banco.from("horarios").select("id, dia, tipo, abre, fecha, fechado").order("dia"),
        banco.from("revendas").select("*").eq("id", sessao.revenda.id).single()
    ]);

    if (c.error || p.error || h.error || r.error) {
        throw c.error || p.error || h.error || r.error;
    }

    catalogo = c.data;
    precos = p.data;
    horarios = h.data;
    revenda = r.data;
}


/* ==========================================
   A ASSINATURA

   Não existe mais interruptor de "pôr no ar". Quem pagou aparece;
   vencido, some. Um botão a mais era um jeito de o dono ficar
   invisível sem perceber, e um telefonema a mais para o suporte.

   O medo de pôr no ar uma revenda sem preço se resolveu sozinho: a
   busca cruza com a tabela de preços, então quem não cadastrou nada
   não aparece em resultado nenhum.
========================================== */

// A partir de quantos dias antes do vencimento o cartão fica amarelo.
const AVISAR_ANTES_DIAS = 7;

function desenharAssinatura() {
    const cartao = document.getElementById("cartao-no-ar");
    const titulo = document.getElementById("titulo-no-ar");
    const explica = document.getElementById("explica-no-ar");

    cartao.hidden = false;

    const vence = revenda.assinatura_vencimento;
    const faltam = vence ? diasAte(vence) : null;
    const plano = planoOu(revenda.plano);

    if (faltam !== null && faltam <= AVISAR_ANTES_DIAS) {
        cartao.className = "cartao-no-ar perto";
        titulo.textContent = faltam === 0 ? "A assinatura vence hoje"
            : faltam === 1 ? "A assinatura vence amanhã"
            : "A assinatura vence em " + faltam + " dias";
        explica.textContent = "Renove até " + dataEscrita(vence)
            + " para a revenda continuar na busca. O prazo novo conta a partir desse dia.";
    } else {
        cartao.className = "cartao-no-ar sim";
        titulo.textContent = "Assinatura em dia";
        explica.textContent = vence
            ? plano.nome + ". A sua revenda aparece na busca até " + dataEscrita(vence) + "."
            : "A sua revenda aparece na busca.";
    }
}

/** Quantos dias faltam até a data, contando no fuso de Brasília. */
function diasAte(iso) {
    const hoje = new Date(hojeNoBrasil() + "T00:00:00Z");
    const alvo = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
    return Math.round((alvo - hoje) / 86400000);
}

function abrirRenovacao() {
    const bloco = document.getElementById("bloco-renovar");
    const botao = document.getElementById("botao-renovar");

    if (!bloco.hidden) {
        bloco.hidden = true;
        bloco.innerHTML = "";
        botao.textContent = "Renovar agora";
        return;
    }

    botao.textContent = "Fechar";

    desenharPagamento(bloco, {
        titulo: "Renovar a assinatura",
        explica: "O prazo novo começa quando o atual termina: renovar adiantado não perde nenhum dia.",
        aoPagar: async ({ vencimento }) => {
            const { data } = await conectar()
                .from("revendas")
                .select("plano, assinatura_status, assinatura_vencimento")
                .eq("id", revenda.id)
                .single();

            if (data) Object.assign(revenda, data);
            else if (vencimento) revenda.assinatura_vencimento = vencimento;

            desenharAssinatura();
            botao.textContent = "Renovar agora";
        }
    });

    bloco.scrollIntoView({ behavior: "smooth", block: "start" });
}


/** 2027-09-12 vira "12/09/2027". */
function dataEscrita(iso) {
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return d + "/" + m + "/" + a;
}


/* ==========================================
   AS ABAS
========================================== */

function desenharAbas() {
    document.getElementById("abas").innerHTML = ABAS.map((a) => `
        <button type="button" class="${a.id === abaAtual ? "ativa" : ""}" data-aba="${esc(a.id)}">${esc(a.nome)}</button>
    `).join("");
}

function abrirAba(id) {
    abaAtual = ABAS.some((a) => a.id === id) ? id : "precos";
    desenharAbas();

    const area = document.getElementById("area");
    area.className = "";

    if (abaAtual === "precos") area.innerHTML = telaPrecos();
    else if (abaAtual === "horarios") area.innerHTML = telaHorarios();
    else if (abaAtual === "entrega") area.innerHTML = telaEntrega();
    else area.innerHTML = telaRevenda();
}


/* ==========================================
   ABA: PREÇOS
========================================== */

function precoDoItem(itemId) {
    return precos.find((p) => p.item_id === itemId) || null;
}

function telaPrecos() {
    const porTipo = (tipo) => catalogo.filter((i) => i.tipo === tipo).map((item) => {
        const p = precoDoItem(item.id);
        const tem = Boolean(p);

        return `
            <div class="linha-preco${tem && !p.disponivel ? " esgotado" : ""}">
                <div class="nome-item">
                    ${esc(item.nome)}
                    ${tem ? `<small>${esc(quandoMexeu(p.atualizado_em))}</small>` : ""}
                </div>

                <div class="campo-preco">
                    <span>R$</span>
                    <input type="text" inputmode="decimal" data-preco="${esc(item.id)}"
                           value="${tem ? esc(comoSeDigita(p.preco)) : ""}"
                           placeholder="0,00">
                </div>

                <label class="tem-hoje" title="Desmarque quando acabar o estoque">
                    <input type="checkbox" data-disponivel="${esc(item.id)}" ${!tem || p.disponivel ? "checked" : ""}>
                    Tenho
                </label>
            </div>
        `;
    }).join("");

    return `
        <section class="secao">
            <h2>Preços</h2>
            <p class="explica">
                Preencha só o que você vende. O que ficar em branco não
                aparece na busca. Desmarque "Tenho" quando acabar o
                estoque: o item some do site sem você perder o preço.
            </p>

            <h3 class="titulo-tipo">🔥 Gás</h3>
            ${porTipo("gas")}

            <h3 class="titulo-tipo">💧 Água</h3>
            ${porTipo("agua")}

            ${telaExtras()}

            <div class="barra-salvar">
                <button type="button" class="botao" data-salvar="precos">Salvar</button>
            </div>
        </section>
    `;
}


/**
 * O que a revenda vende além do catálogo, só marcando. Fica na mesma
 * aba dos preços, e salva no mesmo botão: é a mesma pergunta, "o que
 * você vende", e dois botões de salvar na mesma tela fazem a pessoa
 * apertar um e perder o que marcou no outro.
 */
function telaExtras() {
    const marcados = new Set(revenda.extras || []);

    const grupos = GRUPOS_EXTRAS.map((grupo) => `
        <p class="grupo-extras">${esc(grupo)}</p>
        <div class="lista-extras">
            ${EXTRAS.filter((e) => e.grupo === grupo).map((e) => `
                <label class="marca-extra">
                    <input type="checkbox" data-extra="${esc(e.id)}" ${marcados.has(e.id) ? "checked" : ""}>
                    <span>${esc(e.nome)}${seloMaiores(e)}</span>
                </label>`).join("")}
        </div>`).join("");

    return `
        <h3 class="titulo-tipo">🛒 Também vendo</h3>
        <p class="explica">
            Marque o que mais você vende. Aparece no seu cartão na busca como
            "também vende", com preço a consultar: o cliente pergunta no WhatsApp.
        </p>
        ${grupos}`;
}


/**
 * 97.5 vira "97,50".
 *
 * Sempre com as duas casas, porque "97,5" num campo de preço parece
 * digitação pela metade — e quem abre esta tela para conferir o preço
 * do botijão repara nisso antes de reparar em qualquer outra coisa.
 */
function comoSeDigita(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2).replace(".", ",");
}


/** "mexido hoje", "há 3 dias", "há 2 meses". Preço velho é reclamação. */
function quandoMexeu(quando) {
    if (!quando) return "";

    const dias = Math.floor((Date.now() - new Date(quando).getTime()) / 86400000);

    if (dias <= 0) return "mexido hoje";
    if (dias === 1) return "mexido ontem";
    if (dias < 30) return "mexido há " + dias + " dias";
    if (dias < 60) return "mexido há mais de um mês";
    return "mexido há mais de " + Math.floor(dias / 30) + " meses";
}


async function salvarPrecos() {
    const banco = conectar();
    const paraGravar = [];
    const paraApagar = [];

    catalogo.forEach((item) => {
        const campo = document.querySelector(`[data-preco="${item.id}"]`);
        const marca = document.querySelector(`[data-disponivel="${item.id}"]`);
        const bruto = campo.value.trim().replace(/\./g, "").replace(",", ".");
        const existente = precoDoItem(item.id);

        if (!bruto) {
            // Campo esvaziado quer dizer "não vendo mais isto". Apagar,
            // e não guardar com zero: preço zero na busca aparece como
            // de graça.
            if (existente) paraApagar.push(existente.id);
            return;
        }

        const valor = Number(bruto);
        if (!Number.isFinite(valor) || valor < 0) return;

        paraGravar.push({
            revenda_id: revenda.id,
            item_id: item.id,
            preco: valor,
            disponivel: marca.checked,
            atualizado_em: new Date().toISOString()
        });
    });

    const botao = document.querySelector('[data-salvar="precos"]');
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        if (paraApagar.length) {
            const { error } = await banco.from("precos").delete().in("id", paraApagar);
            if (error) throw error;
        }
        if (paraGravar.length) {
            const { error } = await banco.from("precos")
                .upsert(paraGravar, { onConflict: "revenda_id,item_id" });
            if (error) throw error;
        }

        // O "também vendo" só vai ao banco quando mudou.
        const extras = EXTRAS
            .filter((e) => document.querySelector(`[data-extra="${e.id}"]`)?.checked)
            .map((e) => e.id);
        const antes = (revenda.extras || []).slice().sort().join(",");
        if (extras.slice().sort().join(",") !== antes) {
            const { error } = await banco.from("revendas").update({ extras }).eq("id", revenda.id);
            if (error) throw error;
            revenda.extras = extras;
        }

        const { data, error } = await banco.from("precos")
            .select("id, item_id, preco, disponivel, atualizado_em");
        if (error) throw error;

        precos = data;
        avisar("Salvo.");
        abrirAba("precos");
    } catch (erro) {
        console.error("Erro ao salvar preços:", erro);
        avisar("Não consegui salvar. Tente de novo.", "erro");
        botao.disabled = false;
        botao.textContent = "Salvar";
    }
}


/* ==========================================
   ABA: HORÁRIOS
========================================== */

function horarioDe(dia, tipo) {
    return horarios.find((h) => h.dia === dia && h.tipo === tipo)
        || { dia, tipo, abre: "08:00", fecha: "18:00", fechado: true };
}


function telaHorarios() {
    /*
       Duas colunas, uma por tipo de atendimento, cada uma com os sete
       dias. Lado a lado no computador, empilhadas no celular.

       Antes era um bloco por dia com as duas linhas dentro. Parecia
       econômico e era pior: quem vai cadastrar horário está pensando em
       UM assunto de cada vez — "a entrega funciona assim" — e ter de
       pular a linha da retirada a cada dia obriga a trocar de assunto
       catorze vezes.
    */
    const coluna = (tipo, titulo, explica) => `
        <div class="coluna-horario">
            <h3 class="titulo-coluna">${esc(titulo)}</h3>
            <p class="explica-coluna">${esc(explica)}</p>

            <button type="button" class="botao-vazio botao-miudo" data-copiar="${esc(tipo)}">
                Repetir a segunda nos outros dias
            </button>

            ${ORDEM_NA_TELA.map((dia) => {
                const h = horarioDe(dia, tipo);
                return `
                    <div class="dia-linha${h.fechado ? " fechado" : ""}" data-h="${dia}-${tipo}">
                        <span class="nome-dia">${esc(DIAS[dia])}</span>

                        <div class="horas">
                            <input type="time" data-campo="abre" value="${esc(String(h.abre).slice(0, 5))}">
                            <span class="ate">até</span>
                            <input type="time" data-campo="fecha" value="${esc(String(h.fecha).slice(0, 5))}">
                        </div>

                        <label class="fecha-hoje">
                            <input type="checkbox" data-campo="fechado" ${h.fechado ? "checked" : ""}>
                            Não atende
                        </label>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    return `
        <section class="secao">
            <h2>Horários</h2>
            <p class="explica">
                Retirada e entrega são separadas de propósito: na vida
                real o balcão abre mais cedo e a entrega para antes. Quem
                pede entrega vê se a ENTREGA está funcionando, não se a
                loja está aberta.
            </p>
            <p class="explica">
                Fecha antes de abre quer dizer que atravessa a
                madrugada: das 22:00 às 02:00 vira o dia. Para dia e
                noite, ponha 00:00 nos dois.
            </p>

            <div class="duas-colunas">
                ${coluna("retirada", "Dia e horário de retirada", "Quando o cliente pode ir buscar no balcão.")}
                ${coluna("entrega",  "Dia e horário de entrega",  "Quando você leva até o endereço do cliente.")}
            </div>

            <div class="barra-salvar">
                <button type="button" class="botao" data-salvar="horarios">Salvar horários</button>
            </div>
        </section>
    `;
}


function lerHorariosDaTela() {
    return [...document.querySelectorAll("[data-h]")].map((caixa) => {
        const [dia, tipo] = caixa.dataset.h.split("-");
        return {
            dia: Number(dia),
            tipo,
            abre: caixa.querySelector('[data-campo="abre"]').value || "08:00",
            fecha: caixa.querySelector('[data-campo="fecha"]').value || "18:00",
            fechado: caixa.querySelector('[data-campo="fechado"]').checked
        };
    });
}


/**
 * Copia a segunda para os outros dias, dentro de UMA coluna.
 *
 * Sete pares de hora digitados um a um, vezes duas colunas, é onde o
 * dono desiste do cadastro. A esmagadora maioria repete o mesmo horário
 * a semana toda e só corrige o sábado e o domingo depois.
 *
 * Vale por coluna, e não para as duas de uma vez, porque a entrega e o
 * balcão quase nunca têm o mesmo horário — copiar os dois juntos daria
 * o trabalho de desfazer.
 */
function copiarSegunda(tipo) {
    const atuais = lerHorariosDaTela();
    const molde = atuais.find((h) => h.dia === 1 && h.tipo === tipo);
    if (!molde) return;

    horarios = atuais.map((h) =>
        h.tipo === tipo
            ? { ...h, abre: molde.abre, fecha: molde.fecha, fechado: molde.fechado }
            : h
    );

    abrirAba("horarios");
    avisar("Copiado na coluna de " + (tipo === "entrega" ? "entrega" : "retirada") + ". Confira o sábado e o domingo.");
}


async function salvarHorarios() {
    const novos = lerHorariosDaTela();

    const botao = document.querySelector('[data-salvar="horarios"]');
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const banco = conectar();

    try {
        // Apagar tudo e gravar de novo, em vez de casar linha a linha.
        // São catorze linhas; a conta de descobrir o que mudou custaria
        // mais código do que vale, e é onde nasceria o horário
        // duplicado.
        const { error: erroApagar } = await banco.from("horarios").delete().eq("revenda_id", revenda.id);
        if (erroApagar) throw erroApagar;

        const { error } = await banco.from("horarios").insert(
            novos.map((h) => ({ ...h, revenda_id: revenda.id }))
        );
        if (error) throw error;

        const { data, error: erroLer } = await banco.from("horarios")
            .select("id, dia, tipo, abre, fecha, fechado").order("dia");
        if (erroLer) throw erroLer;

        horarios = data;
        avisar("Horários salvos.");
        abrirAba("horarios");
    } catch (erro) {
        console.error("Erro ao salvar horários:", erro);
        avisar("Não consegui salvar os horários. Tente de novo.", "erro");
        botao.disabled = false;
        botao.textContent = "Salvar horários";
    }
}


/* ==========================================
   ABA: ENTREGA
========================================== */

function telaEntrega() {
    return `
        <section class="secao">
            <h2>Entrega</h2>
            <p class="explica">
                Isto decide para quem você aparece. Quem pede entrega só
                vê quem entrega, e dentro do raio. Quem vai buscar só vê
                quem atende no balcão.
            </p>

            <label class="marcar">
                <input type="checkbox" id="faz-entrega" ${revenda.faz_entrega ? "checked" : ""}>
                <span>
                    <strong>Eu entrego</strong>
                    Levo até o endereço do cliente.
                </span>
            </label>

            <label class="marcar">
                <input type="checkbox" id="faz-retirada" ${revenda.faz_retirada ? "checked" : ""}>
                <span>
                    <strong>O cliente pode buscar</strong>
                    Atendo no balcão, quem quiser vir pegar.
                </span>
            </label>

            <div class="campo" id="campo-raio">
                <label for="raio">Até quantos quilômetros você entrega?</label>
                <input type="number" id="raio" min="1" max="60" step="0.5" value="${esc(String(revenda.raio_entrega_km))}">
                <p class="dica">
                    É uma promessa. Dentro deste raio você aparece, e vai
                    ter de atender. Raio inflado para aparecer mais é
                    pedido recusado — e o cliente recusado não volta ao
                    site.
                </p>
            </div>

            <div class="campo" id="campo-taxa">
                <label for="taxa">Taxa de entrega (R$)</label>
                <input type="text" id="taxa" inputmode="decimal" placeholder="0,00"
                       value="${Number(revenda.taxa_entrega) > 0 ? esc(Number(revenda.taxa_entrega).toFixed(2).replace(".", ",")) : ""}">
                <p class="dica">
                    Em branco, o cliente vê "Entrega grátis". Com valor, ele
                    já vê a taxa somada no total antes de chamar você — e
                    não desiste no meio da conversa.
                </p>
            </div>

            <h3 class="titulo-tipo">Formas de pagamento que você aceita</h3>
            <p class="explica">
                Marque só o que aceita. Quem escolher uma forma que você
                não aceita vê o aviso no seu cartão antes de pedir.
            </p>

            ${FORMAS_DE_PAGAMENTO.map((f) => `
                <label class="marcar">
                    <input type="checkbox" data-forma="${esc(f.id)}"
                           ${(revenda.pagamentos || []).includes(f.id) ? "checked" : ""}>
                    <span><strong>${esc(f.nome)}</strong></span>
                </label>
            `).join("")}

            <div class="barra-salvar">
                <button type="button" class="botao" data-salvar="entrega">Salvar</button>
            </div>
        </section>
    `;
}


async function salvarEntrega() {
    const entrega = document.getElementById("faz-entrega").checked;
    const retirada = document.getElementById("faz-retirada").checked;
    const raio = Number(document.getElementById("raio").value);

    // "5", "5,00" e "5.00" viram 5. Em branco é entrega grátis.
    const taxaTexto = document.getElementById("taxa").value.replace(/[^\d,.]/g, "");
    const taxa = !taxaTexto ? 0 : Number(taxaTexto.includes(",")
        ? taxaTexto.replace(/\./g, "").replace(",", ".")
        : taxaTexto);

    const pagamentos = [...document.querySelectorAll("[data-forma]")]
        .filter((c) => c.checked)
        .map((c) => c.dataset.forma);

    if (!entrega && !retirada) {
        avisar("Marque pelo menos uma: ou você entrega, ou o cliente busca. Sem nenhuma das duas, ninguém consegue comprar.", "erro");
        return;
    }
    if (entrega && (!Number.isFinite(raio) || raio <= 0 || raio > 60)) {
        avisar("O raio de entrega precisa ser um número entre 1 e 60 quilômetros.", "erro");
        return;
    }
    if (entrega && (!Number.isFinite(taxa) || taxa < 0 || taxa > 500)) {
        avisar("A taxa de entrega precisa ser um valor em reais, como 5,00. Deixe em branco se a entrega é grátis.", "erro");
        return;
    }
    if (!pagamentos.length) {
        avisar("Marque pelo menos uma forma de pagamento. Sem nenhuma, o cliente não tem como pagar você.", "erro");
        return;
    }

    const botao = document.querySelector('[data-salvar="entrega"]');
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const { error } = await conectar().from("revendas").update({
        faz_entrega: entrega,
        faz_retirada: retirada,
        raio_entrega_km: entrega ? raio : revenda.raio_entrega_km,
        taxa_entrega: entrega ? taxa : revenda.taxa_entrega,
        pagamentos
    }).eq("id", revenda.id);

    if (error) {
        console.error("Erro ao salvar entrega:", error);
        avisar("Não consegui salvar. Tente de novo.", "erro");
        botao.disabled = false;
        botao.textContent = "Salvar";
        return;
    }

    revenda.faz_entrega = entrega;
    revenda.faz_retirada = retirada;
    if (entrega) {
        revenda.raio_entrega_km = raio;
        revenda.taxa_entrega = taxa;
    }
    revenda.pagamentos = pagamentos;

    avisar("Salvo.");
    botao.disabled = false;
    botao.textContent = "Salvar";
}


/* ==========================================
   ABA: A REVENDA
========================================== */

function telaRevenda() {
    return `
        <section class="secao">
            <h2>A revenda</h2>
            <p class="explica">É o que o cliente vê no seu cartão, na lista.</p>

            <div class="campo">
                <label for="nome">Nome</label>
                <input type="text" id="nome" value="${esc(revenda.nome)}">
            </div>

            <div class="campo">
                <label for="whatsapp">WhatsApp que recebe os pedidos</label>
                <input type="tel" id="whatsapp" inputmode="numeric" value="${esc(revenda.whatsapp)}">
                <p class="dica">Só números, com o DDD.</p>
            </div>

            <div class="campo">
                <label for="endereco">Endereço, como aparece na lista</label>
                <input type="text" id="endereco" value="${esc(revenda.endereco_texto)}">
            </div>

            <!-- Só leitura: a cidade e o estado vão junto com o ponto no
                 mapa, e mudam pelo suporte. Revenda antiga não tem os
                 dois, e o campo nem aparece. -->
            ${revenda.cidade || revenda.uf ? `
            <div class="campo">
                <label for="cidade-revenda">Cidade</label>
                <input type="text" id="cidade-revenda" readonly tabindex="-1"
                       value="${esc([revenda.cidade, revenda.uf].filter(Boolean).join(" – "))}">
            </div>` : ""}

            <div class="campo">
                <label for="logo">Logo</label>
                <div class="linha-logo">
                    <div class="previa-logo" id="previa-logo"
                         style="${revenda.logo_url ? `background-image:url(${esc(revenda.logo_url)})` : ""}"></div>
                    <input type="file" id="logo" accept="image/png,image/jpeg,image/webp">
                </div>
                <p class="dica">Quadrada fica melhor. Até 2 MB.</p>
            </div>

            <p class="explica aviso-endereco">
                <strong>O ponto no mapa não muda por aqui.</strong>
                O endereço acima é só o texto que o cliente lê. A
                coordenada, que decide a distância e quem vê o seu
                anúncio, foi gravada no cadastro. Se a revenda mudou de
                lugar, fale com o suporte — mudar sozinho poria você no
                lugar errado da lista sem ninguém perceber.
            </p>

            <div class="barra-salvar">
                <button type="button" class="botao" data-salvar="revenda">Salvar</button>
            </div>
        </section>
    `;
}


async function salvarRevenda() {
    const nome = document.getElementById("nome").value.trim();
    const whatsapp = document.getElementById("whatsapp").value.replace(/\D/g, "");
    const endereco = document.getElementById("endereco").value.trim();

    if (nome.length < 3) { avisar("Informe o nome da revenda.", "erro"); return; }

    const so = whatsapp.startsWith("55") && whatsapp.length > 11 ? whatsapp.slice(2) : whatsapp;
    if (so.length !== 10 && so.length !== 11) {
        avisar("O WhatsApp precisa ter o DDD e o número. Ex: 31999999999", "erro");
        return;
    }

    const botao = document.querySelector('[data-salvar="revenda"]');
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const mudancas = { nome, whatsapp: so, endereco_texto: endereco };

    const arquivo = document.getElementById("logo").files[0];
    if (arquivo) {
        const enviada = await enviarLogo(arquivo);
        if (enviada) mudancas.logo_url = enviada;
    }

    const { error } = await conectar().from("revendas").update(mudancas).eq("id", revenda.id);

    if (error) {
        console.error("Erro ao salvar a revenda:", error);
        avisar("Não consegui salvar. Tente de novo.", "erro");
        botao.disabled = false;
        botao.textContent = "Salvar";
        return;
    }

    Object.assign(revenda, mudancas);
    document.getElementById("quem-sou").textContent = revenda.nome;
    avisar("Salvo.");
    botao.disabled = false;
    botao.textContent = "Salvar";
}


/**
 * Manda a logo para o Storage.
 *
 * O nome do arquivo é o id da revenda, então enviar de novo substitui a
 * anterior em vez de acumular imagens órfãs. O `?v=` no fim força o
 * navegador a buscar a nova: sem ele, o endereço é o mesmo e a logo
 * antiga fica no cache por horas.
 */
async function enviarLogo(arquivo) {
    if (arquivo.size > 2 * 1024 * 1024) {
        avisar("A logo está muito pesada. Use uma imagem de até 2 MB.", "erro");
        return null;
    }

    const extensao = (arquivo.name.split(".").pop() || "png").toLowerCase();
    const caminho = revenda.id + "." + extensao;

    const { error } = await conectar().storage
        .from("logos")
        .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });

    if (error) {
        console.error("Erro ao enviar a logo:", error);
        avisar("Não consegui enviar a logo. O resto foi salvo.", "erro");
        return null;
    }

    const { data } = conectar().storage.from("logos").getPublicUrl(caminho);
    return data.publicUrl + "?v=" + Date.now();
}


/* ==========================================
   LIGAR A TELA
========================================== */

document.addEventListener("click", (evento) => {
    const aba = evento.target.closest("[data-aba]");
    if (aba) { abrirAba(aba.dataset.aba); return; }

    const salvar = evento.target.closest("[data-salvar]");
    if (salvar) {
        const qual = salvar.dataset.salvar;
        if (qual === "precos") salvarPrecos();
        else if (qual === "horarios") salvarHorarios();
        else if (qual === "entrega") salvarEntrega();
        else salvarRevenda();
        return;
    }

    const copiar = evento.target.closest("[data-copiar]");
    if (copiar) { copiarSegunda(copiar.dataset.copiar); return; }

    if (evento.target.closest("#botao-sair")) sair();
});

// O dia marcado muda de cor sem esperar o salvar.
document.addEventListener("change", (evento) => {
    // O bloco do dia apaga na hora que a pessoa marca "não atende",
    // sem esperar o salvar.
    const fechado = evento.target.closest('[data-campo="fechado"]');
    if (fechado) fechado.closest("[data-h]").classList.toggle("fechado", fechado.checked);

    if (evento.target.id === "logo") {
        const arquivo = evento.target.files[0];
        const previa = document.getElementById("previa-logo");
        if (arquivo && previa) {
            previa.textContent = "";
            previa.style.backgroundImage = "url(" + URL.createObjectURL(arquivo) + ")";
        }
    }
});


(async function iniciar() {
    sessao = await exigirLogin();
    if (!sessao) return;

    document.getElementById("quem-sou").textContent = sessao.revenda.nome;

    try {
        await carregarTudo();
    } catch (erro) {
        console.error("Erro ao carregar o painel:", erro);
        document.getElementById("area").textContent =
            "Não consegui carregar os seus dados. Recarregue a página.";
        return;
    }

    desenharAssinatura();
    document.getElementById("botao-renovar").addEventListener("click", abrirRenovacao);
    abrirAba("precos");
})();
