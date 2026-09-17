// ============================================================
// supabase/functions/pagar-assinatura/index.ts
//
// Gera o Pix da assinatura da revenda logada, pelo Mercado Pago.
//
// Quem chama é a caixa de pagamento (js/pagamento.js), só com o
// plano escolhido. A resposta traz o QR Code e o copia e cola.
//
// Duas coisas que o navegador manda são ignoradas de propósito:
//
//   - o valor: sai da tabela PLANOS, abaixo. Se viesse da tela,
//     bastaria alterar o campo para assinar por um centavo;
//   - a revenda: sai da sessão. Se viesse da tela, bastaria trocar o
//     id para pagar e liberar outra.
//
// Quem libera a revenda é a webhook-mercadopago, quando o Pix cai. Se
// o Mercado Pago já responder aprovado, o crédito sai aqui mesmo: a
// resposta veio dele para este servidor, e não do navegador.
//
// Suba com --no-verify-jwt. A sessão é conferida aqui dentro, com
// auth.getUser(): o projeto usa as chaves novas do Supabase, e a
// conferência automática do gateway não é a que decide.
//
// Segredos: MERCADOPAGO_ACCESS_TOKEN.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";

// Os mesmos valores do js/planos.js. Os de lá só desenham a tela;
// quem cobra são estes.
const PLANOS: Record<string, { valor: number; descricao: string }> = {
    mensal: { valor: 9.9, descricao: "Achei Água & Gás — Plano Mensal" },
    anual: { valor: 99, descricao: "Achei Água & Gás — Plano Anual" }
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (!MP_TOKEN) {
        return resposta({ erro: "O pagamento ainda não está configurado. Tente mais tarde." }, 503);
    }

    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        // --- quem está pagando ------------------------------------
        const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        const { data: sessao } = await supabase.auth.getUser(token);
        if (!sessao?.user) {
            return resposta({ erro: "Sua sessão expirou. Entre de novo para pagar." }, 401);
        }

        const { data: usuario } = await supabase
            .from("usuarios")
            .select("revenda_id, ativo, revendas(id, nome, assinatura_status)")
            .eq("auth_id", sessao.user.id)
            .maybeSingle();

        // O tipo gerado acha que a relação é uma lista; usuarios tem uma
        // revenda só, e o PostgREST devolve o objeto.
        const revenda = usuario?.revendas as unknown as { id: string; nome: string; assinatura_status: string } | null;
        if (!usuario || !usuario.ativo || !revenda) {
            return resposta({ erro: "Esta conta não está ligada a uma revenda." }, 403);
        }

        // Bloqueio do administrador não se desfaz pagando. Cobrar e não
        // liberar seria pegar o dinheiro e não entregar nada.
        if (revenda.assinatura_status === "suspensa" || revenda.assinatura_status === "cancelada") {
            return resposta({ erro: "Esta revenda está bloqueada. Fale com a gente pelo WhatsApp antes de pagar." }, 403);
        }

        // --- o que está sendo pago --------------------------------
        const body = await req.json().catch(() => ({}));
        const plano = PLANOS[body?.plano];
        if (!plano) return resposta({ erro: "Escolha o plano." }, 400);

        // O Mercado Pago exige um e-mail do pagador. Vai o da conta: é
        // quem está pagando, e é por onde a gente fala com a revenda.
        const email = String(sessao.user.email ?? "").trim();
        if (!email) return resposta({ erro: "Esta conta está sem e-mail. Fale com a gente." }, 400);

        // --- a linha do pagamento, antes de cobrar ----------------
        const { data: pagamento, error: erroPagamento } = await supabase
            .from("pagamentos")
            .insert({ revenda_id: revenda.id, plano: body.plano, valor: plano.valor, metodo: "pix" })
            .select("id")
            .single();

        if (erroPagamento) throw erroPagamento;

        // --- a cobrança -------------------------------------------
        const corpo = {
            transaction_amount: plano.valor,
            description: plano.descricao,
            payment_method_id: "pix",
            payer: { email },
            external_reference: pagamento.id,
            notification_url: `${SUPABASE_URL}/functions/v1/webhook-mercadopago`
        };

        const mp = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${MP_TOKEN}`,
                "Content-Type": "application/json",
                // O id do nosso pagamento: se o pedido chegar repetido, o
                // Mercado Pago devolve a mesma cobrança em vez de fazer outra.
                "X-Idempotency-Key": pagamento.id
            },
            body: JSON.stringify(corpo)
        });

        const cobrado = await mp.json().catch(() => null);

        if (!mp.ok || !cobrado?.id) {
            console.error("[pagar] o Mercado Pago recusou o pedido:", JSON.stringify(cobrado));
            await supabase.from("pagamentos")
                .update({ status: "cancelado", retorno: cobrado, atualizado_em: new Date().toISOString() })
                .eq("id", pagamento.id);
            return resposta({ erro: "Não foi possível gerar o Pix. Tente de novo em instantes." }, 400);
        }

        const status = String(cobrado.status);
        const situacao = situacaoDe(status);

        await supabase.from("pagamentos")
            .update({
                gateway_id: String(cobrado.id),
                status: situacao,
                retorno: cobrado,
                atualizado_em: new Date().toISOString()
            })
            .eq("id", pagamento.id);

        if (situacao === "pago") {
            const { data: vencimento, error } = await supabase.rpc("creditar_pagamento", { p_pagamento: pagamento.id });
            if (error) {
                // O dinheiro caiu; o aviso do Mercado Pago tenta creditar de
                // novo. Não é motivo para dizer à pessoa que falhou.
                console.error("[pagar] pago, mas não creditou:", error);
            }
            return resposta({ aprovado: true, vencimento: vencimento ?? null, pagamento: pagamento.id });
        }

        const pix = cobrado.point_of_interaction?.transaction_data ?? null;

        if (situacao === "cancelado" || !pix) {
            console.error("[pagar] Pix sem QR:", cobrado.status, cobrado.status_detail);
            return resposta({ erro: "Não foi possível gerar o Pix. Tente de novo em instantes." }, 502);
        }

        return resposta({
            aprovado: false,
            pagamento: pagamento.id,
            pixQrBase64: pix?.qr_code_base64 ?? null,
            pixCopiaECola: pix?.qr_code ?? null
        });

    } catch (erro) {
        console.error("[pagar] erro inesperado:", erro);
        return resposta({ erro: "Não foi possível gerar o Pix. Tente de novo em instantes." }, 500);
    }
});


function situacaoDe(status: string): string {
    if (status === "approved") return "pago";
    if (status === "rejected" || status === "cancelled") return "cancelado";
    if (status === "refunded" || status === "charged_back") return "estornado";
    return "pendente";
}

function resposta(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}
