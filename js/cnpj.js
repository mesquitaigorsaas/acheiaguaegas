// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: cnpj.js
// Versão: 1.0
// ==========================================

/*
   Conferir o CNPJ antes de aceitar.

   Não é preciosismo. O CNPJ é o que vai na nota da assinatura, e um
   dígito trocado só aparece no dia de emitir — com o cliente já pago,
   já usando, e agora precisando de uma nota que não sai. Descobrir na
   hora de digitar custa cinco segundos; descobrir no fim do mês custa
   um telefonema e uma nota cancelada.

   A conta abaixo é o dígito verificador do próprio CNPJ: os dois
   últimos números são calculados a partir dos doze primeiros. Ela pega
   digitação errada, não pega CNPJ inventado que por acaso feche a
   conta, e não diz nada sobre a empresa estar ativa na Receita.

   Para saber se existe de verdade seria preciso consultar a Receita, e
   isso é passo para quando houver volume. Por ora, esta conta já evita
   a esmagadora maioria dos erros, que são de digitação.
*/

function somenteDigitos(texto) {
    return String(texto || "").replace(/\D/g, "");
}


function cnpjValido(bruto) {
    const n = somenteDigitos(bruto);

    if (n.length !== 14) return false;

    // 11111111111111 fecha a conta dos dígitos verificadores, e é o que
    // sai quando alguém segura uma tecla. Todos iguais nunca é CNPJ.
    if (/^(\d)\1{13}$/.test(n)) return false;

    return digito(n, 12) === Number(n[12])
        && digito(n, 13) === Number(n[13]);
}


/**
 * O dígito da posição pedida.
 *
 * Os pesos vão de 2 a 9, repetindo, contados de trás para a frente —
 * é assim que a Receita define, e trocar a ordem faz a conta fechar
 * para CNPJ errado.
 */
function digito(n, ate) {
    let soma = 0;
    let peso = 2;

    for (let i = ate - 1; i >= 0; i--) {
        soma += Number(n[i]) * peso;
        peso = peso === 9 ? 2 : peso + 1;
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}


/** 12345678000199 vira 12.345.678/0001-99, para a pessoa conferir. */
function cnpjEscrito(bruto) {
    const n = somenteDigitos(bruto);
    if (n.length !== 14) return bruto;

    return n.slice(0, 2) + "." + n.slice(2, 5) + "." + n.slice(5, 8)
         + "/" + n.slice(8, 12) + "-" + n.slice(12);
}
