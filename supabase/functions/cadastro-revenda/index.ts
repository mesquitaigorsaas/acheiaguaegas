// ============================================================
// supabase/functions/cadastro-revenda/index.ts
//
// Edge Function PÚBLICA: cria uma revenda a partir da tela de
// anunciar. Quem chama é visitante sem conta, então ela não
// exige login.
//
// Por que existe uma função em vez de o navegador escrever
// direto no banco: criar o acesso no Supabase Auth e amarrar o
// usuário à revenda exige a chave de serviço, que é secreta e
// nunca pode entrar em arquivo de navegador. As regras do
// policies.sql, de propósito, não deixam ninguém criar revenda.
//
// Cria, nesta ordem:
//   1. a revenda, despublicada e aguardando pagamento
//   2. o acesso (e-mail + senha) no Supabase Auth
//   3. o usuário dono, ligando os dois
//   4. o mínimo para o painel não abrir vazio: uma faixa de
//      horário para o dono corrigir
//
// Se qualquer passo falhar, desfaz os anteriores. Melhor não
// existir do que existir pela metade — revenda sem dono não tem
// quem entre para consertá-la.
//
// Suba com --no-verify-jwt.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const erro = validar(body);
        if (erro) return resposta({ erro }, 400);

        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const cnpj = somenteNumeros(body.cnpj);
        const email = String(body.email).trim().toLowerCase();
        const nome = String(body.nome).trim();

        // --- 1. a revenda -----------------------------------------
        const { data: revenda, error: erroRevenda } = await supabase
            .from("revendas")
            .insert({
                nome,
                cnpj,
                whatsapp: semCodigoDePais(somenteNumeros(body.whatsapp)),
                telefone_responsavel: semCodigoDePais(somenteNumeros(body.telefone)),
                endereco_texto: String(body.endereco_texto ?? "").trim() || String(body.rua).trim(),
                latitude: Number(body.latitude),
                longitude: Number(body.longitude),
                // Despublicada: ela ainda não tem preço nenhum
                // cadastrado, e uma revenda sem preço na busca é pior
                // que revenda nenhuma — o cliente clica e não acha o
                // que veio procurar.
                publicado: false,
                assinatura_status: "aguardando_pagamento"
            })
            .select("id")
            .single();

        if (erroRevenda) {
            // 23505 = valor duplicado. O único campo único aqui é o CNPJ.
            if (erroRevenda.code === "23505") {
                return resposta({ erro: "Já existe uma revenda cadastrada com este CNPJ." }, 400);
            }
            console.error("Erro ao criar revenda:", erroRevenda);
            return resposta({ erro: "Não foi possível criar o cadastro. Tente novamente." }, 400);
        }

        // --- 2. o acesso ------------------------------------------
        const { data: auth, error: erroAuth } = await supabase.auth.admin.createUser({
            email,
            password: body.senha,
            // Confirmado na hora. Um e-mail de confirmação caindo no
            // spam, somado à espera da liberação, é o cliente perdido
            // entre se cadastrar e usar.
            email_confirm: true
        });

        if (erroAuth) {
            await supabase.from("revendas").delete().eq("id", revenda.id);
            return resposta({ erro: traduzErroAcesso(erroAuth.message) }, 400);
        }

        // --- 3. o usuário dono ------------------------------------
        const { error: erroUsuario } = await supabase.from("usuarios").insert({
            auth_id: auth.user.id,
            revenda_id: revenda.id,
            nome: String(body.responsavel).trim(),
            perfil: "dono",
            ativo: true
        });

        if (erroUsuario) {
            await supabase.auth.admin.deleteUser(auth.user.id);
            await supabase.from("revendas").delete().eq("id", revenda.id);
            console.error("Erro ao criar usuário:", erroUsuario);
            return resposta({ erro: "Não foi possível concluir o cadastro. Tente novamente." }, 400);
        }

        // --- 4. o mínimo para o painel não abrir vazio -------------
        // Uma faixa de horário para o dono corrigir. Sem nenhuma, a
        // revenda fica "fechada" para sempre e ele não vê por quê.
        // Falha aqui não desfaz nada: o cadastro está de pé e ele cria
        // a faixa à mão em dois cliques.
        await supabase.from("horarios").insert({
            revenda_id: revenda.id,
            rotulo: "Segunda a sábado",
            dias_semana: [1, 2, 3, 4, 5, 6],
            abre: "08:00",
            fecha: "18:00",
            ordem: 1
        });

        return resposta({ ok: true, revenda_id: revenda.id }, 200);
    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        return resposta({ erro: "Erro inesperado. Tente novamente." }, 500);
    }
});


// ------------------------------------------------------------
// Validação
//
// Esta função é pública: tudo que chega é conferido aqui dentro.
// O que o navegador validou não vale nada, porque dá para chamar
// a função sem passar pela tela.
// ------------------------------------------------------------
function validar(body) {
    const obrigatorios = [
        "nome", "cnpj", "rua", "cidade", "uf",
        "whatsapp", "responsavel", "telefone",
        "email", "senha", "latitude", "longitude"
    ];

    for (const campo of obrigatorios) {
        if (body?.[campo] === undefined || body?.[campo] === null || String(body[campo]).trim() === "") {
            return "Preencha todos os campos.";
        }
    }

    if (String(body.nome).trim().length < 3) return "Informe o nome do estabelecimento.";
    if (!cnpjValido(body.cnpj)) return "O CNPJ não confere. Veja se algum número saiu trocado.";

    const whatsapp = semCodigoDePais(somenteNumeros(body.whatsapp));
    if (whatsapp.length !== 10 && whatsapp.length !== 11) {
        return "O WhatsApp precisa ter o DDD e o número. Ex: 35999999999";
    }

    const telefone = semCodigoDePais(somenteNumeros(body.telefone));
    if (telefone.length !== 10 && telefone.length !== 11) {
        return "O telefone do responsável precisa ter o DDD e o número.";
    }

    if (String(body.responsavel).trim().length < 3) return "Informe o nome do responsável.";
    if (!String(body.email).includes("@")) return "Informe um e-mail válido.";
    if (String(body.senha).length < 6) return "A senha precisa ter pelo menos 6 caracteres.";

    // A coordenada é o que faz a revenda existir na busca. Sem ela,
    // ou com ela fora do Brasil, a revenda nasce invisível e ninguém
    // descobre o motivo — nem o dono, que só estranha não receber
    // pedido.
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return "Não consegui achar o endereço no mapa. Confira a rua e a cidade.";
    }
    if (lat < -34 || lat > 6 || lon < -74 || lon > -34) {
        return "O endereço caiu fora do Brasil. Confira a rua e a cidade.";
    }

    return null;
}


function somenteNumeros(texto) {
    return String(texto ?? "").replace(/\D/g, "");
}

/**
 * Tira o 55 de quem digitou o código do país. Só corta quando
 * sobra número demais: existe DDD 55, o do Rio Grande do Sul, e
 * ele não pode virar código de país e perder dois dígitos.
 */
function semCodigoDePais(so: string) {
    return so.startsWith("55") && so.length > 11 ? so.slice(2) : so;
}


/**
 * O dígito verificador do CNPJ. A mesma conta do js/cnpj.js, e
 * repetida aqui de propósito: o navegador pode ser burlado, esta
 * função não.
 */
function cnpjValido(bruto) {
    const n = somenteNumeros(bruto);
    if (n.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(n)) return false;

    const digito = (ate: number) => {
        let soma = 0;
        let peso = 2;
        for (let i = ate - 1; i >= 0; i--) {
            soma += Number(n[i]) * peso;
            peso = peso === 9 ? 2 : peso + 1;
        }
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    return digito(12) === Number(n[12]) && digito(13) === Number(n[13]);
}


function traduzErroAcesso(mensagem) {
    const texto = (mensagem ?? "").toLowerCase();
    if (texto.includes("already been registered") || texto.includes("already exists")) {
        return "Este e-mail já está cadastrado. Use outro ou fale com o suporte.";
    }
    if (texto.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
    return "Não foi possível criar o acesso. Confira o e-mail informado.";
}


function resposta(corpo: unknown, status: number) {
    return new Response(JSON.stringify(corpo), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status
    });
}
