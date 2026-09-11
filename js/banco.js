// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: banco.js
// Versão: 1.0
// ==========================================

/*
   De onde vêm os dados. Único arquivo que sabe disso.

   Enquanto as credenciais abaixo estiverem em branco, o site roda em
   modo demonstração, lendo data/demo.json. Serve para dois momentos: o
   de agora, em que o banco ainda não existe, e o de sempre, em que é
   preciso mostrar o produto a um cliente novo sem depender de nada
   estar no ar.

   Os dois caminhos devolvem O MESMO FORMATO. É o que permite trocar a
   fonte sem mexer em quem desenha a tela.

   PARA LIGAR NO BANCO DE VERDADE:
     1. Crie o projeto no Supabase
     2. Rode supabase/schema.sql, depois policies.sql, depois itens.sql
     3. Cole aqui o endereço e a chave publicável

   A chave pode ficar à vista: sozinha ela não dá acesso a nada. Quem
   decide o que cada um enxerga são as regras do policies.sql, que rodam
   dentro do banco.
*/

const BANCO = {
    url: "",
    chavePublica: ""
};


function temBanco() {
    return Boolean(BANCO.url && BANCO.chavePublica && window.supabase);
}

let clienteBanco = null;

function conectar() {
    if (!temBanco()) return null;
    if (!clienteBanco) {
        clienteBanco = window.supabase.createClient(BANCO.url, BANCO.chavePublica);
    }
    return clienteBanco;
}


/* ==========================================
   O CATÁLOGO
========================================== */

let catalogoLido = null;

async function carregarCatalogo() {
    if (catalogoLido) return catalogoLido;

    if (temBanco()) {
        const { data, error } = await conectar()
            .from("itens")
            .select("id, tipo, nome, apelido, ordem")
            .eq("ativo", true)
            .order("ordem");

        if (error) throw error;
        catalogoLido = data;
        return catalogoLido;
    }

    catalogoLido = (await lerDemo()).itens;
    return catalogoLido;
}


/* ==========================================
   A BUSCA
========================================== */

/**
 * Quem entrega neste ponto, com distância, preço e se está aberta.
 *
 * No banco, quem responde é a função `buscar` do Postgres — e é ela,
 * não uma consulta à tabela, de propósito: com leitura livre em
 * `revendas`, um visitante baixaria a lista inteira de assinantes com
 * um comando, que é a carteira de clientes do negócio servida a um
 * concorrente.
 *
 * Na demonstração, a mesma conta é feita aqui. O resultado tem os
 * mesmos campos, na mesma ordem.
 */
async function buscarRevendas(lat, lng, itemId, raioMax = 30) {
    if (temBanco()) {
        const { data, error } = await conectar().rpc("buscar", {
            p_lat: lat,
            p_lon: lng,
            p_item: itemId,
            p_raio_max: raioMax
        });

        if (error) throw error;
        return data || [];
    }

    return buscarNaDemonstracao(lat, lng, itemId, raioMax);
}


async function buscarNaDemonstracao(lat, lng, itemId, raioMax) {
    const dados = await lerDemo();
    const agora = new Date();

    return dados.revendas
        .map((r) => {
            const preco = r.precos[itemId];
            if (preco === undefined) return null;

            const km = distanciaEmKm(lat, lng, r.latitude, r.longitude);
            if (km === null) return null;

            // O corte é pelo MENOR entre o raio dela e o teto pedido.
            // Quem está a oito quilômetros e entrega em dez atende; quem
            // está a dois e entrega em um, não.
            if (km > Math.min(r.raio_entrega_km, raioMax)) return null;

            return {
                revenda_id: r.id,
                nome: r.nome,
                logo_url: r.logo_url,
                whatsapp: r.whatsapp,
                endereco: r.endereco,
                distancia_km: Math.round(km * 100) / 100,
                aberta: estaAberta(r.horarios, agora),
                preco: preco,
                preco_visto_em: null
            };
        })
        .filter(Boolean)
        // Aberta primeiro, depois preço, depois distância. Gás fechado
        // não serve a quem quer hoje; e preço vem antes de distância
        // porque é por isso que a pessoa entrou num site de comparação.
        .sort((a, b) =>
            (b.aberta - a.aberta)
            || (a.preco - b.preco)
            || (a.distancia_km - b.distancia_km));
}


let demoLida = null;

async function lerDemo() {
    if (demoLida) return demoLida;

    const resposta = await fetch("data/demo.json");
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);

    demoLida = await resposta.json();
    return demoLida;
}
