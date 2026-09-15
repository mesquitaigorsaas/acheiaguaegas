// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: anunciar.js
// Versão: 1.0
// ==========================================

/*
   O cadastro da revenda.

   Curto de propósito. O que faz ela aparecer na busca — preço, horário,
   raio de entrega, se entrega ou é balcão só — fica no painel, depois
   de entrar. Numa tela de trinta campos o dono desiste no meio, e o que
   se perde não é o cadastro: é o cliente.

   Aqui ficam só as quatro coisas sem as quais não dá para começar: quem
   é a revenda, onde ela fica, por onde falar com ela, e como ela entra
   no painel.

   O ENDEREÇO É O CAMPO QUE MAIS IMPORTA, e o único que a pessoa não
   consegue conferir sozinha. Por isso ele tem um botão que procura no
   mapa e mostra o que achou, antes de salvar. Endereço errado põe a
   revenda no lugar errado da lista, e ninguém descobre — nem ela, que
   só estranha não receber pedido.
*/

const estado = {
    onde: null,      // { lat, lng } depois de conferido no mapa
    logo: null       // o arquivo escolhido, se houver
};


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

function valor(id) {
    const campo = document.getElementById(id);
    return campo ? campo.value.trim() : "";
}


/* ==========================================
   O CNPJ
========================================== */

/**
 * Confere enquanto a pessoa digita, e não só no envio.
 *
 * Descobrir o erro no fim manda ela procurar qual dos quatorze números
 * saiu errado, e a essa altura ela já não lembra de onde copiou.
 */
function conferirCnpj() {
    const campo = document.getElementById("cnpj");
    const dica = document.getElementById("dica-cnpj");
    const n = somenteDigitos(campo.value);

    if (!n) {
        dica.textContent = "Só números. É o que vai na nota da assinatura.";
        dica.className = "dica";
        return;
    }

    if (n.length < 14) {
        dica.textContent = "Faltam " + (14 - n.length) + (14 - n.length === 1 ? " número." : " números.");
        dica.className = "dica";
        return;
    }

    if (cnpjValido(n)) {
        campo.value = cnpjEscrito(n);
        dica.textContent = "CNPJ confere.";
        dica.className = "dica boa";
        return;
    }

    dica.textContent = "Este CNPJ não confere. Veja se algum número saiu trocado.";
    dica.className = "dica ruim";
}


/* ==========================================
   O ENDEREÇO NO MAPA
========================================== */

async function acharEndereco() {
    const botao = document.getElementById("botao-achar-endereco");
    const achado = document.getElementById("achado");

    const rua = valor("rua");
    const cidade = valor("cidade");

    if (!rua || !cidade) {
        avisar("Preencha a rua e a cidade antes de conferir no mapa.", "erro");
        return null;
    }

    botao.disabled = true;
    botao.textContent = "Procurando no mapa...";
    avisar("");

    const ponto = await ondeFica({
        cep: somenteDigitos(valor("cep")),
        rua,
        bairro: valor("bairro"),
        cidade,
        uf: valor("uf")
    });

    botao.disabled = false;
    botao.textContent = "Conferir este endereço no mapa";

    if (!ponto) {
        estado.onde = null;
        achado.hidden = true;
        avisar(
            "Não achei este endereço no mapa. Confira a rua e a cidade. "
            + "Sem isso a sua revenda não consegue aparecer na busca por distância.",
            "erro"
        );
        return null;
    }

    estado.onde = { lat: ponto.lat, lng: ponto.lng };

    // Mostrar o que foi achado, e não só um "ok": quem digitou a rua
    // errada precisa VER que o mapa entendeu outra coisa. Um visto
    // verde esconderia o erro que este botão existe para pegar.
    achado.hidden = false;
    achado.className = "achado";
    achado.innerHTML = "Achei no mapa: <strong>" + esc(ponto.escrito || [rua, cidade].join(", ")) + "</strong>"
        + "<br><a href=\"https://www.google.com/maps?q=" + ponto.lat + "," + ponto.lng
        + "\" target=\"_blank\" rel=\"noopener\">Ver o ponto no mapa</a>"
        + " — se cair longe da sua revenda, corrija o endereço acima.";

    return estado.onde;
}


/* ==========================================
   A LOGO
========================================== */

function escolherLogo(evento) {
    const arquivo = evento.target.files && evento.target.files[0];
    const previa = document.getElementById("previa-logo");

    if (!arquivo) {
        estado.logo = null;
        previa.textContent = "💧";
        previa.style.backgroundImage = "";
        return;
    }

    // 2 MB. Logo de revenda é um desenho simples; acima disso é foto
    // tirada do celular, que demora a carregar na lista e não fica
    // melhor por ser grande.
    if (arquivo.size > 2 * 1024 * 1024) {
        avisar("A logo está muito pesada. Use uma imagem de até 2 MB.", "erro");
        evento.target.value = "";
        return;
    }

    estado.logo = arquivo;
    previa.textContent = "";
    previa.style.backgroundImage = "url(" + URL.createObjectURL(arquivo) + ")";
}


/* ==========================================
   AS SENHAS
========================================== */

function ligarVerSenha() {
    document.querySelectorAll("[data-ver-senha]").forEach((botao) => {
        botao.addEventListener("click", () => {
            const campo = document.getElementById(botao.dataset.verSenha);
            const visivel = campo.type === "text";
            campo.type = visivel ? "password" : "text";
            botao.textContent = visivel ? "Mostrar" : "Ocultar";
        });
    });
}

function conferirSenhas() {
    const senha = document.getElementById("senha");
    const repetir = document.getElementById("repetir-senha");
    const aviso = document.getElementById("aviso-senhas");

    if (!repetir.value) {
        aviso.textContent = "";
        aviso.className = "dica";
        return;
    }

    const iguais = senha.value === repetir.value;
    aviso.textContent = iguais ? "As senhas conferem." : "As duas senhas não são iguais.";
    aviso.className = "dica " + (iguais ? "boa" : "ruim");
}


/* ==========================================
   ENVIAR
========================================== */

function conferirTudo(dados) {
    if (dados.nome.length < 3) return "Informe o nome do estabelecimento.";
    if (!cnpjValido(dados.cnpj)) return "O CNPJ não confere. Veja se algum número saiu trocado.";
    if (!dados.rua) return "Informe a rua da revenda.";
    if (!dados.cidade) return "Informe a cidade.";
    if (dados.uf.length !== 2) return "A UF tem duas letras. Ex: MG";

    if (dados.whatsapp.length !== 10 && dados.whatsapp.length !== 11) {
        return "O WhatsApp precisa ter o DDD e o número. Ex: 35999999999";
    }
    if (dados.responsavel.length < 3) return "Informe o seu nome.";
    if (dados.telefone.length !== 10 && dados.telefone.length !== 11) {
        return "O seu telefone precisa ter o DDD e o número. Ex: 35988887777";
    }

    if (!dados.email.includes("@")) return "Informe um e-mail válido.";
    if (dados.senha.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
    if (dados.senha !== dados.repetirSenha) return "As duas senhas não são iguais.";

    return null;
}


/** Tira o 55 de quem digitou o código do país junto. */
function semCodigoDePais(so) {
    return so.startsWith("55") && so.length > 11 ? so.slice(2) : so;
}


async function aoCadastrar(evento) {
    evento.preventDefault();
    avisar("");

    const dados = {
        nome: valor("nome"),
        cnpj: somenteDigitos(valor("cnpj")),
        rua: valor("rua"),
        numero: valor("numero"),
        bairro: valor("bairro"),
        cidade: valor("cidade"),
        uf: valor("uf").toUpperCase(),
        cep: somenteDigitos(valor("cep")),
        whatsapp: semCodigoDePais(somenteDigitos(valor("whatsapp"))),
        responsavel: valor("responsavel"),
        telefone: semCodigoDePais(somenteDigitos(valor("telefone"))),
        email: valor("email").toLowerCase(),
        senha: document.getElementById("senha").value,
        repetirSenha: document.getElementById("repetir-senha").value
    };

    const erro = conferirTudo(dados);
    if (erro) {
        avisar(erro, "erro");
        return;
    }

    const botao = document.getElementById("botao-cadastrar");
    botao.disabled = true;
    botao.textContent = "Criando...";

    // Sem coordenada a revenda não entra na busca por distância, que é
    // o site inteiro. Se a pessoa não apertou o botão de conferir, a
    // gente procura por ela agora, em silêncio.
    if (!estado.onde) {
        await acharEndereco();
    }

    if (!estado.onde) {
        botao.disabled = false;
        botao.textContent = "Criar minha conta";
        return;
    }

    dados.latitude = estado.onde.lat;
    dados.longitude = estado.onde.lng;
    dados.endereco_texto = [
        [dados.rua, dados.numero].filter(Boolean).join(", "),
        dados.bairro
    ].filter(Boolean).join(" — ");

    if (!temBanco()) {
        botao.disabled = false;
        botao.textContent = "Criar minha conta";
        avisar(
            "O site ainda está em demonstração e não tem banco ligado, "
            + "então o cadastro não foi gravado. Tudo o mais funcionou: "
            + "o CNPJ confere e o endereço foi achado no mapa.",
            "erro"
        );
        console.log("O cadastro que seria enviado:", dados);
        return;
    }

    // A repetição da senha só faz sentido nesta tela. Mandar para o
    // servidor seria mandar a senha duas vezes pela rede sem motivo.
    const { repetirSenha, ...paraOServidor } = dados;

    const { data, error } = await conectar()
        .functions.invoke("cadastro-revenda", { body: paraOServidor });

    botao.disabled = false;
    botao.textContent = "Criar minha conta";

    if (error || (data && data.erro)) {
        avisar(await mensagemDoErro(error, data), "erro");
        return;
    }

    mostrarPronto(dados);
}


/**
 * A Edge Function devolve o motivo em português dentro do corpo, mas
 * num status 400 o cliente do Supabase entrega só um "non-2xx" genérico
 * e guarda o corpo na resposta. Sem abrir esse corpo, todo erro de
 * cadastro vira a mesma frase inútil na tela.
 */
async function mensagemDoErro(error, data) {
    if (data && data.erro) return data.erro;

    try {
        const corpo = await error?.context?.json();
        if (corpo && corpo.erro) return corpo.erro;
    } catch (_) {
        // Resposta sem JSON: cai na frase geral, abaixo.
    }

    return "Não foi possível criar a conta. Tente novamente.";
}


function mostrarPronto(dados) {
    avisar("");
    document.getElementById("form-cadastro").hidden = true;

    document.getElementById("resumo-pronto").textContent =
        dados.nome + " está cadastrada. Entre com " + dados.email + ".";

    document.getElementById("bloco-pronto").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}


/* ==========================================
   LIGAR A TELA
========================================== */

(function iniciar() {
    document.getElementById("cnpj").addEventListener("blur", conferirCnpj);
    document.getElementById("cnpj").addEventListener("input", conferirCnpj);
    document.getElementById("logo").addEventListener("change", escolherLogo);
    document.getElementById("botao-achar-endereco").addEventListener("click", acharEndereco);
    document.getElementById("form-cadastro").addEventListener("submit", aoCadastrar);

    document.getElementById("senha").addEventListener("input", conferirSenhas);
    document.getElementById("repetir-senha").addEventListener("input", conferirSenhas);

    // Mexeu no endereço, a coordenada conferida não vale mais. Sem isto
    // a pessoa confere um endereço, troca a rua, e salva com o ponto
    // antigo — o pior dos erros, porque ninguém percebe.
    ["cep", "rua", "numero", "bairro", "cidade", "uf"].forEach((id) => {
        document.getElementById(id).addEventListener("input", () => {
            estado.onde = null;
            document.getElementById("achado").hidden = true;
        });
    });

    ligarVerSenha();
})();
