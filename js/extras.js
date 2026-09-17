// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: extras.js
// Versão: 1.0
// ==========================================

/*
   O que a revenda vende além de gás e água: acessórios, carvão, gelo,
   bebidas. Sem preço — o cliente vê "preço a consultar" e pergunta no
   WhatsApp.

   FICA FORA DO PEDIDO de propósito. O pedido é o que se compara: total,
   mais barata, quem tem tudo. Um item sem preço dentro dessa conta
   bagunçaria a ordem. Aqui é só "também vende", e o cliente pode marcar
   o que quer saber o preço.

   LISTA FECHADA, pelo mesmo motivo do catálogo: "mangueira",
   "mangueira de gás" e "mangueira PVC" seriam três coisas. A chave é o
   que se grava na coluna revendas.extras, e a mesma lista está na trava
   do supabase/010-extras.sql. Item novo entra nos dois lugares.
*/

const EXTRAS = [
    { id: "suporte_galao", nome: "Suporte para galão",         curto: "suporte para galão",  grupo: "Para água" },
    { id: "bomba_galao",   nome: "Bomba para galão",           curto: "bomba para galão",    grupo: "Para água" },
    { id: "vela_filtro",   nome: "Vela / refil de filtro",     curto: "vela de filtro",      grupo: "Para água" },
    { id: "mangueira_gas", nome: "Mangueira de gás",           curto: "mangueira de gás",    grupo: "Para gás" },
    { id: "registro_gas",  nome: "Registro / regulador de gás", curto: "registro de gás",    grupo: "Para gás" },
    { id: "abracadeira",   nome: "Abraçadeira",                curto: "abraçadeira",         grupo: "Para gás" },
    { id: "carvao",        nome: "Carvão",                     curto: "carvão",              grupo: "Churrasco" },
    { id: "gelo",          nome: "Gelo",                       curto: "gelo",                grupo: "Churrasco" },
    { id: "refrigerante",  nome: "Refrigerante",               curto: "refrigerante",        grupo: "Bebidas e utilidades" },
    // Venda proibida para menores: o aviso vai junto do nome em toda tela.
    { id: "cerveja",       nome: "Cerveja",                    curto: "cerveja",             grupo: "Bebidas e utilidades", maiores: true },
    { id: "copos",         nome: "Copos descartáveis",         curto: "copos descartáveis",  grupo: "Bebidas e utilidades" }
];

const GRUPOS_EXTRAS = ["Para água", "Para gás", "Churrasco", "Bebidas e utilidades"];

function extraPorId(id) {
    return EXTRAS.find((e) => e.id === id) || null;
}

/** O selo de +18, ao lado do nome, onde for preciso. */
function seloMaiores(extra) {
    return extra && extra.maiores ? ` <span class="selo-18" title="Venda proibida para menores de 18 anos">+18</span>` : "";
}

/** Os extras de uma lista de ids, na ordem da lista fechada. */
function extrasDe(ids) {
    const tem = new Set(ids || []);
    return EXTRAS.filter((e) => tem.has(e.id));
}
