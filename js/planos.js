// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: planos.js
// Versão: 1.0
// ==========================================

/*
   Os planos, num lugar só.

   R$ 5,00 por mês, ou R$ 50,00 por ano. O anual sai por dez meses:
   dois de graça para quem paga adiantado.

   Estes valores são só para MOSTRAR. Quem cobra é o servidor, e os
   números de verdade estão na Edge Function. Se viessem daqui,
   bastaria mudar o campo no navegador para assinar por um centavo.

   Por que tão barato: o produto novo não tem revenda cadastrada, e
   revenda sem revenda vizinha não vale nada para o cliente. Os
   primeiros assinantes estão pagando para entrar num site vazio, e o
   preço reflete isso. Quando a busca começar a mandar pedido, o preço
   sobe — para quem entrar depois.
*/

const PLANOS = {
    mensal: {
        nome: "Plano Mensal",
        valor: "R$ 5,00 por mês",
        resumo: "Sem fidelidade. Cancele quando quiser."
    },

    anual: {
        nome: "Plano Anual",
        valor: "R$ 50,00 por ano",
        resumo: "Dois meses de graça em relação ao mensal."
    }
};

// O plano em destaque. O anual é melhor para os dois lados: o dono
// economiza dois meses e a gente cobra uma vez em vez de doze.
const PLANO_PADRAO = "anual";


function planoOu(nome) {
    return PLANOS[nome] || PLANOS[PLANO_PADRAO];
}
