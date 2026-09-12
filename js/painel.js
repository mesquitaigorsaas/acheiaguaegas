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

   No topo, acima das abas, fica o selo de "no ar". É a única coisa que
   responde à pergunta que o dono realmente tem, que é se o anúncio
   dele está aparecendo. Escondê-la dentro de uma aba seria escondê-la.

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
    { id: "entrega",  nome: "Entrega" },
    { id: "revenda",  nome: "A revenda" }
];

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];


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
        banco.from("horarios").select("id, rotulo, dias_semana, abre, fecha, ordem").order("ordem"),
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
   O SELO DE NO AR
========================================== */

function desenharNoAr() {
    const cartao = document.getElementById("cartao-no-ar");
    const titulo = document.getElementById("titulo-no-ar");
    const explica = document.getElementById("explica-no-ar");
    const botao = document.getElementById("botao-publicar");

    const comPreco = precos.filter((p) => p.disponivel).length;
    const comHorario = horarios.length;

    cartao.hidden = false;
    cartao.className = "cartao-no-ar " + (revenda.publicado ? "sim" : "nao");

    if (revenda.publicado) {
        titulo.textContent = "A sua revenda está no ar";
        explica.textContent = "Quem procurar água ou gás perto de você encontra o seu anúncio.";
        botao.textContent = "Tirar do ar";
        botao.className = "botao botao-vazio";
        botao.disabled = false;
        return;
    }

    titulo.textContent = "A sua revenda está fora do ar";
    botao.textContent = "Pôr no ar";
    botao.className = "botao";

    // Publicar sem preço põe no ar um anúncio que não responde a
    // ninguém: o cliente clica e não acha o que veio procurar. Sem
    // horário, ela aparece fechada para sempre, e o dono não descobre
    // por quê. Os dois freios são do próprio dono, e não punição.
    const falta = [];
    if (!comPreco) falta.push("cadastrar pelo menos um preço");
    if (!comHorario) falta.push("cadastrar o horário");

    if (falta.length) {
        explica.textContent = "Antes de pôr no ar, falta " + emLista(falta) + ".";
        botao.disabled = true;
        return;
    }

    explica.textContent = "Ninguém encontra o seu anúncio enquanto ele estiver fora do ar.";
    botao.disabled = false;
}


async function alternarPublicado() {
    const botao = document.getElementById("botao-publicar");
    botao.disabled = true;

    const novo = !revenda.publicado;
    const { error } = await conectar().from("revendas").update({ publicado: novo }).eq("id", revenda.id);

    if (error) {
        avisar("Não consegui mudar agora. Tente de novo.", "erro");
        botao.disabled = false;
        return;
    }

    revenda.publicado = novo;
    desenharNoAr();
    avisar(novo ? "Pronto, a sua revenda está no ar." : "A sua revenda saiu do ar.");
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
                           value="${tem ? esc(String(p.preco).replace(".", ",")) : ""}"
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

            <div class="barra-salvar">
                <button type="button" class="botao" data-salvar="precos">Salvar preços</button>
            </div>
        </section>
    `;
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

        const { data, error } = await banco.from("precos")
            .select("id, item_id, preco, disponivel, atualizado_em");
        if (error) throw error;

        precos = data;
        avisar("Preços salvos.");
        desenharNoAr();
        abrirAba("precos");
    } catch (erro) {
        console.error("Erro ao salvar preços:", erro);
        avisar("Não consegui salvar os preços. Tente de novo.", "erro");
        botao.disabled = false;
        botao.textContent = "Salvar preços";
    }
}


/* ==========================================
   ABA: HORÁRIOS
========================================== */

function telaHorarios() {
    const faixas = horarios.map((h, i) => `
        <div class="faixa" data-faixa="${i}">
            <div class="campo">
                <label>Nome da faixa</label>
                <input type="text" data-h="rotulo" value="${esc(h.rotulo)}" placeholder="Segunda a sábado">
            </div>

            <div class="dias">
                ${DIAS.map((d, n) => `
                    <label class="dia${(h.dias_semana || []).includes(n) ? " marcado" : ""}">
                        <input type="checkbox" data-h="dia" data-dia="${n}" ${(h.dias_semana || []).includes(n) ? "checked" : ""}>
                        ${esc(d.slice(0, 3))}
                    </label>
                `).join("")}
            </div>

            <div class="linha-campos">
                <div class="campo cresce">
                    <label>Abre</label>
                    <input type="time" data-h="abre" value="${esc(String(h.abre).slice(0, 5))}">
                </div>
                <div class="campo cresce">
                    <label>Fecha</label>
                    <input type="time" data-h="fecha" value="${esc(String(h.fecha).slice(0, 5))}">
                </div>
            </div>

            <button type="button" class="botao-vazio botao-perigo" data-apagar-faixa="${i}">Apagar esta faixa</button>
        </div>
    `).join("");

    return `
        <section class="secao">
            <h2>Horários</h2>
            <p class="explica">
                É o horário que decide se você aparece como aberta. O
                cliente que procura agora vê primeiro quem está aberto —
                e a busca já vem filtrando assim.
            </p>
            <p class="explica">
                Fecha antes de abre quer dizer que atravessa a
                madrugada. Das 22:00 às 02:00 vira o dia. Para dia e
                noite, ponha 00:00 nos dois.
            </p>

            ${faixas || '<p class="vazio-painel">Nenhuma faixa cadastrada. Sem horário, você aparece como fechada o tempo todo.</p>'}

            <button type="button" class="botao-vazio" data-nova-faixa>Acrescentar faixa</button>

            <div class="barra-salvar">
                <button type="button" class="botao" data-salvar="horarios">Salvar horários</button>
            </div>
        </section>
    `;
}


function lerHorariosDaTela() {
    return [...document.querySelectorAll("[data-faixa]")].map((caixa) => {
        const dias = [...caixa.querySelectorAll('[data-h="dia"]')]
            .filter((c) => c.checked)
            .map((c) => Number(c.dataset.dia));

        return {
            rotulo: caixa.querySelector('[data-h="rotulo"]').value.trim() || "Horário",
            dias_semana: dias,
            abre: caixa.querySelector('[data-h="abre"]').value,
            fecha: caixa.querySelector('[data-h="fecha"]').value
        };
    });
}


async function salvarHorarios() {
    const novas = lerHorariosDaTela();

    for (const f of novas) {
        if (!f.dias_semana.length) {
            avisar("Cada faixa precisa de pelo menos um dia marcado.", "erro");
            return;
        }
        if (!f.abre || !f.fecha) {
            avisar("Preencha a hora de abrir e de fechar em todas as faixas.", "erro");
            return;
        }
    }

    const botao = document.querySelector('[data-salvar="horarios"]');
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const banco = conectar();

    try {
        // Apagar tudo e gravar de novo, em vez de casar linha a linha.
        // São três ou quatro faixas; a conta de descobrir o que mudou
        // custaria mais código do que vale, e é onde nasceria o erro de
        // uma faixa duplicada.
        const { error: erroApagar } = await banco.from("horarios").delete().eq("revenda_id", revenda.id);
        if (erroApagar) throw erroApagar;

        if (novas.length) {
            const { error } = await banco.from("horarios").insert(
                novas.map((f, i) => ({ ...f, revenda_id: revenda.id, ordem: (i + 1) * 10 }))
            );
            if (error) throw error;
        }

        const { data, error } = await banco.from("horarios")
            .select("id, rotulo, dias_semana, abre, fecha, ordem").order("ordem");
        if (error) throw error;

        horarios = data;
        avisar("Horários salvos.");
        desenharNoAr();
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

    if (!entrega && !retirada) {
        avisar("Marque pelo menos uma: ou você entrega, ou o cliente busca. Sem nenhuma das duas, ninguém consegue comprar.", "erro");
        return;
    }
    if (entrega && (!Number.isFinite(raio) || raio <= 0 || raio > 60)) {
        avisar("O raio de entrega precisa ser um número entre 1 e 60 quilômetros.", "erro");
        return;
    }

    const botao = document.querySelector('[data-salvar="entrega"]');
    botao.disabled = true;
    botao.textContent = "Salvando...";

    const { error } = await conectar().from("revendas").update({
        faz_entrega: entrega,
        faz_retirada: retirada,
        raio_entrega_km: entrega ? raio : revenda.raio_entrega_km
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
    if (entrega) revenda.raio_entrega_km = raio;

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

            <div class="campo">
                <label for="logo">Logo</label>
                <div class="linha-logo">
                    <div class="previa-logo" id="previa-logo"
                         style="${revenda.logo_url ? `background-image:url(${esc(revenda.logo_url)})` : ""}">
                        ${revenda.logo_url ? "" : "💧"}
                    </div>
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
        avisar("O WhatsApp precisa ter o DDD e o número. Ex: 35999999999", "erro");
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

    if (evento.target.closest("[data-nova-faixa]")) {
        horarios = lerHorariosDaTela().concat({
            rotulo: "", dias_semana: [1, 2, 3, 4, 5], abre: "08:00", fecha: "18:00"
        });
        abrirAba("horarios");
        return;
    }

    const apagar = evento.target.closest("[data-apagar-faixa]");
    if (apagar) {
        const i = Number(apagar.dataset.apagarFaixa);
        horarios = lerHorariosDaTela().filter((_, n) => n !== i);
        abrirAba("horarios");
        return;
    }

    if (evento.target.closest("#botao-publicar")) alternarPublicado();
    if (evento.target.closest("#botao-sair")) sair();
});

// O dia marcado muda de cor sem esperar o salvar.
document.addEventListener("change", (evento) => {
    const dia = evento.target.closest('[data-h="dia"]');
    if (dia) dia.parentElement.classList.toggle("marcado", dia.checked);

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

    desenharNoAr();
    abrirAba("precos");
})();
