// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: utils.js
// Versão: 1.0
// ==========================================

/*
   As contas e os cuidados que mais de uma tela precisa.
*/


/**
 * Escapa texto antes de virar HTML.
 *
 * Tudo que vem do banco passa por aqui. O nome da revenda é digitado
 * pelo dono, e um nome com aspas — Gás "do Zé" — bastaria para quebrar
 * um atributo e sumir com o cartão da tela. Aspas de verdade aparecem
 * em nome de comércio mais do que se imagina.
 */
function esc(texto) {
    return String(texto === undefined || texto === null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


/** 105 vira "R$ 105,00". */
function dinheiro(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}


/**
 * O número que vai no link do WhatsApp.
 *
 * O dono cadastra como ele fala: DDD e número. Mas o wa.me só funciona
 * com o 55 na frente — sem ele o link abre uma conversa com um número
 * que não existe, e o pedido some sem ninguém entender por quê.
 *
 * Então o 55 entra aqui, e não é obrigação de quem digitou.
 */
function numeroDeZap(bruto) {
    const so = String(bruto || "").replace(/\D/g, "");
    if (so.length === 10 || so.length === 11) return "55" + so;
    return so;
}


/* ==========================================
   ABERTO AGORA
========================================== */

/** "18:30" vira 1110, para comparar hora sem mexer com data. */
function emMinutos(hora) {
    const [h, m] = String(hora || "").split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
}


/**
 * A revenda está aberta agora?
 *
 * Fechamento menor ou igual à abertura quer dizer que a faixa atravessa
 * a meia-noite. "Das 22:00 às 02:00" passa para o dia seguinte, e
 * "das 00:00 às 00:00" é dia e noite, sem fechar.
 *
 * No dia seguinte, antes de fechar, o dia que conta é o de ONTEM: quem
 * abriu sábado às 22h e fecha às 2h ainda está no turno de sábado. Sem
 * isso, a revenda 24 horas apareceria fechada toda madrugada.
 *
 * Isto repete, em JavaScript, a função `esta_aberta` do banco. As duas
 * existem porque a busca de verdade já vem com a resposta pronta do
 * Postgres, e o modo demonstração não tem Postgres nenhum. Se
 * divergirem, o mesmo horário dá dois resultados.
 */
function estaAberta(horarios, agora) {
    const faixas = horarios || [];
    if (!faixas.length) return false;

    const t = agora || new Date();
    const hoje = t.getDay();
    const ontem = (hoje + 6) % 7;
    const minutoAgora = t.getHours() * 60 + t.getMinutes();

    return faixas.some((faixa) => {
        const dias = faixa.dias || faixa.dias_semana || [];
        const abre = emMinutos(faixa.abre);
        const fecha = emMinutos(faixa.fecha);
        if (abre === null || fecha === null) return false;

        if (fecha > abre) {
            return dias.includes(hoje) && minutoAgora >= abre && minutoAgora < fecha;
        }

        // Atravessa a meia-noite.
        return (dias.includes(hoje) && minutoAgora >= abre)
            || (dias.includes(ontem) && minutoAgora < fecha);
    });
}


/**
 * ["um preço", "o horário"] vira "um preço e o horário".
 * Com três ou mais, vira "a, b e c".
 *
 * É a diferença entre um aviso que parece escrito por gente e um que
 * parece log de sistema — e quem lê isto é o dono da revenda, não um
 * programador.
 */
function emLista(itens) {
    const lista = (itens || []).filter(Boolean);
    if (!lista.length) return "";
    if (lista.length === 1) return lista[0];
    return lista.slice(0, -1).join(", ") + " e " + lista[lista.length - 1];
}
