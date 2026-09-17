// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: auth.js
// Versão: 1.0
// ==========================================

/*
   O login do dono da revenda.

   Três perguntas, nesta ordem, e todas precisam de sim:

     1. A senha confere?              — quem responde é o Supabase Auth
     2. A conta pertence a alguma revenda?  — a tabela `usuarios`
     3. A assinatura está em dia?     — a coluna da revenda

   A terceira é a que faz isto ser um negócio. Sem ela, quem parou de
   pagar continua entrando. E ela é conferida a cada carregamento de
   página, não só no login: uma assinatura que vence hoje precisa barrar
   hoje, e não na próxima vez que a pessoa fizer logout.

   O que isto NÃO faz: proteger dado. Quem protege é o RLS, no banco. Se
   alguém burlar estas telas, continua sem enxergar nada de revenda
   alheia, porque as regras rodam do outro lado.
*/

const ONDE_ENTRAR = "entrar.html";
const ONDE_EDITAR = "painel.html";
const ONDE_TROCAR_SENHA = "nova-senha.html";


/* ==========================================
   ENTRAR
========================================== */

async function entrar(email, senha) {
    const banco = conectar();
    if (!banco) return { ok: false, mensagem: "O sistema está sem conexão com o banco." };

    const { data, error } = await banco.auth.signInWithPassword({
        email: String(email || "").trim().toLowerCase(),
        password: senha
    });

    if (error) {
        // A mensagem crua vem em inglês, mas o CÓDIGO separa coisas que
        // a pessoa resolve de jeitos diferentes. Jogar tudo em "e-mail
        // ou senha não conferem" faz quem errou o ritmo trocar a senha
        // dez vezes sem sucesso.
        if (error.code === "over_request_rate_limit" || error.status === 429) {
            return { ok: false, mensagem: "Muitas tentativas seguidas. Espere um minuto e tente de novo." };
        }
        return { ok: false, mensagem: "E-mail ou senha não conferem." };
    }

    const situacao = await situacaoDaConta(data.user.id);

    // Conta válida em revenda bloqueada não fica com sessão aberta.
    //
    // A exceção é quem só falta pagar: a cobrança sai em nome de quem
    // está logado, e sem sessão não teria como pagar. Isso não abre o
    // painel — exigirLogin() confere a situação de novo em cada página
    // — e a assinatura só muda pelo pagamento, conferido no banco.
    if (!situacao.ok && !situacao.podePagar) {
        await banco.auth.signOut();
    }

    return situacao;
}


async function sair() {
    const banco = conectar();
    if (banco) await banco.auth.signOut();
    location.href = ONDE_ENTRAR;
}


/* ==========================================
   ESQUECI A SENHA
========================================== */

/**
 * A resposta é sempre a mesma, exista ou não a conta.
 *
 * Dizer "este e-mail não está cadastrado" transformaria esta tela numa
 * ferramenta para descobrir quem são as revendas assinantes: bastaria
 * testar endereços um a um. O preço é quem digitou errado não descobrir
 * na hora, e esse preço é menor.
 */
async function pedirNovaSenha(email) {
    const banco = conectar();
    if (!banco) return { ok: false, mensagem: "O sistema está sem conexão com o banco." };

    const limpo = String(email || "").trim().toLowerCase();
    if (!limpo.includes("@")) {
        return { ok: false, mensagem: "Informe um e-mail válido." };
    }

    const { error } = await banco.auth.resetPasswordForEmail(limpo, {
        redirectTo: new URL(ONDE_TROCAR_SENHA, location.href).href
    });

    if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
        return { ok: false, mensagem: "Já mandamos um link agora há pouco. Espere alguns minutos e veja a caixa de entrada." };
    }

    return {
        ok: true,
        mensagem: "Se este e-mail tiver conta, o link chega em instantes. Olhe também o spam."
    };
}


/* ==========================================
   A SITUAÇÃO DA CONTA
========================================== */

/**
 * Uma consulta só traz o usuário e a revenda dele, porque o PostgREST
 * sabe seguir a chave estrangeira. Duas consultas separadas dariam a
 * mesma resposta com o dobro de espera.
 */
async function situacaoDaConta(idDeAuth) {
    const banco = conectar();

    const { data: usuario, error } = await banco
        .from("usuarios")
        .select("id, nome, perfil, ativo, revenda_id, revendas(id, nome, cnpj, assinatura_status, assinatura_vencimento, assinatura_link)")
        .eq("auth_id", idDeAuth)
        .maybeSingle();

    if (error) return { ok: false, mensagem: "Não consegui confirmar a sua conta. Tente de novo." };

    if (!usuario) {
        return {
            ok: false,
            mensagem: "Esta conta existe, mas não está ligada a nenhuma revenda. Fale com o suporte."
        };
    }

    if (!usuario.ativo) {
        return { ok: false, mensagem: "O seu acesso foi desativado." };
    }

    const revenda = usuario.revendas;

    // A revenda vai junto nas respostas abaixo: a tela de pagar mostra
    // o nome dela, e o recado de bloqueio também.
    const paraPagar = { id: revenda.id, nome: revenda.nome, cnpj: revenda.cnpj };

    // A madrugada tira do ar quem venceu. Entre a meia-noite e essa
    // hora, a coluna ainda diz "ativa" — e o painel não pode abrir para
    // quem já passou do prazo.
    const vencida = revenda.assinatura_status === "vencida"
        || (revenda.assinatura_status === "ativa"
            && revenda.assinatura_vencimento
            && revenda.assinatura_vencimento < hojeNoBrasil());

    if (revenda.assinatura_status === "aguardando_pagamento") {
        return {
            ok: false,
            podePagar: true,
            revenda: paraPagar,
            mensagem: "Falta ativar a sua revenda. Pague a assinatura abaixo: assim que o pagamento for aprovado, o acesso abre."
        };
    }

    if (vencida) {
        return {
            ok: false,
            podePagar: true,
            revenda: paraPagar,
            mensagem: "A assinatura da sua revenda venceu, e ela saiu da busca. Renove abaixo para voltar na hora."
        };
    }

    if (revenda.assinatura_status !== "ativa") {
        return {
            ok: false,
            bloqueada: true,
            revenda: paraPagar,
            mensagem: "O acesso desta revenda está bloqueado."
        };
    }

    return { ok: true, usuario, revenda };
}


/** O dia de hoje em Brasília, no formato da coluna: "2026-09-17". */
function hojeNoBrasil() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}


/* ==========================================
   A GUARDA DAS PÁGINAS DO PAINEL
========================================== */

/**
 * Chame no começo de toda página do painel. Se não puder entrar, manda
 * para a tela de login e não devolve nada.
 */
async function exigirLogin() {
    const banco = conectar();
    if (!banco) {
        location.href = ONDE_ENTRAR;
        return null;
    }

    const { data } = await banco.auth.getSession();
    if (!data.session) {
        location.href = ONDE_ENTRAR;
        return null;
    }

    const situacao = await situacaoDaConta(data.session.user.id);

    if (!situacao.ok) {
        // Quem só falta pagar continua logado: a tela de entrar abre
        // direto no pagamento, sem pedir a senha de novo.
        if (!situacao.podePagar) await banco.auth.signOut();
        // O motivo viaja na URL para a tela de login poder explicar.
        location.href = ONDE_ENTRAR + "?motivo=" + encodeURIComponent(situacao.mensagem);
        return null;
    }

    return situacao;
}
