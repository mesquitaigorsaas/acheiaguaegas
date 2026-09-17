// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: planos.js
// Versão: 2.0
// ==========================================

/*
   Os planos, num lugar só.

   R$ 9,90 por mês, ou R$ 99,00 por ano. O anual sai por dez meses:
   dois de graça para quem paga adiantado.

   Os valores daqui só desenham a tela. Quem cobra é a Edge Function
   pagar-assinatura, com a tabela dela: mexer nestes números pelo
   navegador não muda um centavo do que é cobrado. Mudou o preço? Mude
   nos dois lugares.

   Por que tão barato: o produto novo não tem revenda cadastrada, e
   revenda sem revenda vizinha não vale nada para o cliente. Os
   primeiros assinantes estão pagando para entrar num site vazio, e o
   preço reflete isso. Quando a busca começar a mandar pedido, o preço
   sobe — para quem entrar depois.
*/

const PLANOS = {
    // O anual primeiro: é o que aparece em destaque na hora de pagar.
    anual: {
        nome: "Plano Anual",
        valor: "R$ 99,00 por ano",
        preco: 99,
        prazo: "12 meses",
        resumo: "Dois meses de graça em relação ao mensal."
    },

    mensal: {
        nome: "Plano Mensal",
        valor: "R$ 9,90 por mês",
        preco: 9.9,
        prazo: "1 mês",
        resumo: "Sem fidelidade. Renove quando quiser."
    }
};

// O plano em destaque. O anual é melhor para os dois lados: o dono
// economiza dois meses e a gente cobra uma vez em vez de doze.
const PLANO_PADRAO = "anual";


// Para onde mandar quem estiver com a revenda bloqueada.
const SUPORTE = {
    whatsapp: "31999347032"
};


function planoOu(nome) {
    return PLANOS[nome] || PLANOS[PLANO_PADRAO];
}
