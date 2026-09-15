// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: planos.js
// Versão: 1.0
// ==========================================

/*
   Os planos, num lugar só.

   R$ 9,90 por mês, ou R$ 99,00 por ano. O anual sai por dez meses:
   dois de graça para quem paga adiantado.

   O preço daqui vai no QR Code do Pix. Mexer nele pelo navegador não
   libera nada: quem ativa a revenda é a gente, depois de conferir o
   comprovante e o valor que caiu na conta.

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
        resumo: "Dois meses de graça em relação ao mensal."
    },

    mensal: {
        nome: "Plano Mensal",
        valor: "R$ 9,90 por mês",
        preco: 9.9,
        resumo: "Sem fidelidade. Cancele quando quiser."
    }
};


/*
   O Pix que recebe as assinaturas, num lugar só.

   A chave pode ficar à vista: é para isso que ela existe. Aleatória, e
   não CPF nem telefone, para não expor documento de ninguém.

   Enquanto a chave, o recebedor ou o WhatsApp estiverem vazios, a tela
   de pagamento avisa que o Pix está sendo configurado, em vez de mostrar
   um QR Code que não paga ninguém.
*/
const PIX = {
    chave: "2e65ca21-3eac-409c-8a65-282eef7897a1",   // a chave aleatória, como o banco mostra
    recebedor: "Igor Vinicius M Costa",   // o nome do titular da conta, até 25 letras
    cidade: "Alfenas",
    whatsapp: "31999347032"               // DDD + número que recebe os comprovantes
};

// O plano em destaque. O anual é melhor para os dois lados: o dono
// economiza dois meses e a gente cobra uma vez em vez de doze.
const PLANO_PADRAO = "anual";


function planoOu(nome) {
    return PLANOS[nome] || PLANOS[PLANO_PADRAO];
}
