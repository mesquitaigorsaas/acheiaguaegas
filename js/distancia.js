// ==========================================
// ACHEI ÁGUA E GÁS
// Arquivo: distancia.js
// Versão: 1.0
// ==========================================

/*
   A distância entre o cliente e a revenda.

   Herdado do Achei República, onde a mesma conta separa a república da
   faculdade. A fórmula é a mesma, e o motivo de existir também.

   O QUE ESTA CONTA NÃO É

   Não é o caminho pela rua. É a linha reta sobre a superfície da Terra,
   e ela não conhece rua, morro, viaduto nem córrego.

   Serve para ORDENAR e COMPARAR, que é o que a busca precisa: entre uma
   revenda a 800 metros e outra a 3 km, a mais perto é a mais perto por
   qualquer caminho.

   Não serve para prometer tempo de entrega, e por isso o site não
   converte isto em minutos em lugar nenhum. Quem promete prazo é o
   entregador, no WhatsApp.

   QUEM CALCULA DE VERDADE É O BANCO

   A busca do cliente já volta com a distância pronta, calculada pela
   função `distancia_km` do Postgres. A conta abaixo existe para o que
   acontece antes de ter banco: a prévia no cadastro, onde o dono marca
   o endereço e vê na hora até onde o raio dele alcança.

   As duas usam a mesma fórmula de propósito. Se divergirem, o dono vê
   um número no cadastro e o cliente vê outro na busca.
*/

function distanciaEmKm(lat1, lng1, lat2, lng2) {
    const n = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
    const a1 = n(lat1), o1 = n(lng1), a2 = n(lat2), o2 = n(lng2);

    if ([a1, o1, a2, o2].some((v) => v === null || !Number.isFinite(v))) return null;

    const R = 6371;                          // raio da Terra em km
    const rad = (g) => g * Math.PI / 180;
    const dLat = rad(a2 - a1);
    const dLng = rad(o2 - o1);

    const h = Math.sin(dLat / 2) ** 2
            + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}


/*
   "1,2 km" — vírgula, porque é português, e uma casa decimal, porque
   duas fingiriam uma precisão que a linha reta não tem.

   Abaixo de um quilômetro vai em metros, arredondado à centena: "800 m"
   se lê mais rápido que "0,8 km", e o arredondamento não deixa escapar
   um "137 m" que soaria medido com trena.
*/
function kmEscrito(km) {
    if (km === null || km === undefined || !Number.isFinite(Number(km))) return null;

    const v = Number(km);
    if (v < 1) return Math.max(100, Math.round(v * 1000 / 100) * 100) + " m";
    return v.toFixed(1).replace(".", ",") + " km";
}
