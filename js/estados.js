// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: estados.js
// Versão: 1.0
// ==========================================

/*
   Os 27 estados, para os selects do endereço. O site vale para o país
   inteiro: quem decide quem atende é a distância e o raio de entrega,
   e não uma lista de cidades.

   A sigla é o que se grava. A mesma lista está na trava do
   supabase/007-estado.sql e na função de cadastro.
*/

const ESTADOS = [
    { uf: "AC", nome: "Acre" },
    { uf: "AL", nome: "Alagoas" },
    { uf: "AP", nome: "Amapá" },
    { uf: "AM", nome: "Amazonas" },
    { uf: "BA", nome: "Bahia" },
    { uf: "CE", nome: "Ceará" },
    { uf: "DF", nome: "Distrito Federal" },
    { uf: "ES", nome: "Espírito Santo" },
    { uf: "GO", nome: "Goiás" },
    { uf: "MA", nome: "Maranhão" },
    { uf: "MT", nome: "Mato Grosso" },
    { uf: "MS", nome: "Mato Grosso do Sul" },
    { uf: "MG", nome: "Minas Gerais" },
    { uf: "PA", nome: "Pará" },
    { uf: "PB", nome: "Paraíba" },
    { uf: "PR", nome: "Paraná" },
    { uf: "PE", nome: "Pernambuco" },
    { uf: "PI", nome: "Piauí" },
    { uf: "RJ", nome: "Rio de Janeiro" },
    { uf: "RN", nome: "Rio Grande do Norte" },
    { uf: "RS", nome: "Rio Grande do Sul" },
    { uf: "RO", nome: "Rondônia" },
    { uf: "RR", nome: "Roraima" },
    { uf: "SC", nome: "Santa Catarina" },
    { uf: "SP", nome: "São Paulo" },
    { uf: "SE", nome: "Sergipe" },
    { uf: "TO", nome: "Tocantins" }
];

function ufValida(uf) {
    return ESTADOS.some((e) => e.uf === String(uf || "").toUpperCase());
}

/**
 * As opções de um <select> de estado. O valor é a sigla, que é o que o
 * CEP devolve e o que se grava; o rótulo tem o nome inteiro, que é como
 * a pessoa procura na lista.
 *
 * `curto` deixa só a sigla, para o select estreito ao lado da cidade.
 */
function opcoesDeEstado(select, rotuloVazio, curto = false) {
    const escolhida = select.value;

    select.innerHTML = `<option value="">${esc(rotuloVazio)}</option>`
        + ESTADOS.map((e) =>
            `<option value="${esc(e.uf)}">${curto ? esc(e.uf) : esc(e.nome) + " (" + esc(e.uf) + ")"}</option>`
        ).join("");

    select.value = escolhida;
}
