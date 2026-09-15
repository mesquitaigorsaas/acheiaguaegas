// ==========================================
// ACHEI ÁGUA & GÁS
// Arquivo: onde.js
// Versão: 1.0
// ==========================================

/*
   Onde a pessoa está, em latitude e longitude.

   Usado pelos dois lados: o cliente, para a busca saber de onde medir,
   e o dono da revenda, no cadastro, para marcar onde fica a loja.

   TRÊS CAMINHOS, PORQUE NENHUM SOZINHO RESOLVE

   1. O GPS do aparelho. É o melhor: um toque, nada para digitar, e a
      precisão é de metros. Mas depende de a pessoa permitir, e no
      computador de mesa costuma errar bairro inteiro.

   2. O CEP na BrasilAPI. Bom quando existe. Cidade pequena, porém, tem
      um CEP geral terminado em -000 para o município inteiro, e aí não
      há coordenada para devolver. Alfenas é assim.

   3. O nome da rua no Nominatim, do OpenStreetMap. Resolve justamente
      o caso que o CEP não resolve.

   Nenhum dos serviços pede chave, e isso não é economia: este site é
   servido como arquivo estático, então qualquer chave dentro dele
   estaria à vista de quem abrisse o código-fonte.

   Tudo isto é herdado do Achei República, onde já rodou contra
   endereços de verdade. As armadilhas comentadas abaixo foram
   descobertas lá, apanhando.
*/


/* ==========================================
   PELO APARELHO
========================================== */

/**
 * Pede a posição ao navegador.
 *
 * Devolve { lat, lng, precisao } ou lança com uma frase que a pessoa
 * entenda. O motivo da recusa importa: quem negou a permissão precisa
 * saber que dá para digitar o endereço, e não ficar olhando um botão
 * que não responde.
 */
function ondeEstouPeloAparelho(prazoMs = 10000) {
    return new Promise((resolver, recusar) => {
        if (!navigator.geolocation) {
            recusar(new Error("Este navegador não sabe dizer onde você está. Digite o endereço."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (p) => resolver({
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                precisao: p.coords.accuracy
            }),
            (erro) => {
                if (erro.code === erro.PERMISSION_DENIED) {
                    recusar(new Error("Você não deu permissão de localização. Digite o endereço e a gente acha igual."));
                    return;
                }
                if (erro.code === erro.TIMEOUT) {
                    recusar(new Error("O aparelho demorou para responder. Digite o endereço."));
                    return;
                }
                recusar(new Error("Não consegui pegar a sua localização. Digite o endereço."));
            },
            {
                // Alta precisão porque a diferença entre dois quarteirões
                // muda quem aparece em primeiro lugar.
                enableHighAccuracy: true,
                timeout: prazoMs,
                // Posição de dez minutos atrás serve: ninguém pede gás
                // andando. Aceitar a guardada evita ligar o GPS à toa.
                maximumAge: 10 * 60 * 1000
            }
        );
    });
}


/* ==========================================
   PELO ENDEREÇO ESCRITO
========================================== */

/** Sem acento e sem maiúscula, para comparar cidade escrita de jeitos diferentes. */
function achatar(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function prazoCurto(ms = 4000) {
    return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
}


/**
 * A coordenada de um CEP.
 *
 * O CEP tem que ser DA CIDADE ESPERADA, quando ela é informada. Um
 * dígito trocado continua sendo um CEP válido de outro lugar:
 * 99999999 devolve uma coordenada no Paraná sem reclamar de nada, e a
 * revenda passaria a ser ordenada a 700 km do cliente. Erro que não dá
 * erro é o que mais custa.
 */
async function coordenadaDoCep(cep, cidadeEsperada) {
    const so = String(cep || "").replace(/\D/g, "");
    if (so.length !== 8) return null;

    try {
        const r = await fetch("https://brasilapi.com.br/api/cep/v2/" + so, { signal: prazoCurto() });
        if (!r.ok) return null;

        const j = await r.json();
        const c = j && j.location && j.location.coordinates;
        if (!c || !c.latitude || !c.longitude) return null;

        if (cidadeEsperada && achatar(j.city) !== achatar(cidadeEsperada)) return null;

        return { lat: Number(c.latitude), lng: Number(c.longitude), como: "cep", cidade: j.city, uf: j.state };
    } catch (e) {
        console.warn("CEP sem coordenada:", e);
        return null;
    }
}


/**
 * A coordenada de um endereço escrito.
 *
 * A busca vai SEM o número e SEM o bairro, de propósito. Com número,
 * quase nada é encontrado. Com bairro, ela falha quando o mapa discorda
 * do bairro que a pessoa escreveu — "Rua Geraldo Freitas da Costa, Vila
 * Teixeira, Alfenas" não acha nada, e sem o bairro acha.
 *
 * A precisão é de TRECHO DE RUA, não da porta. Para ordenar revendas
 * por distância isso basta: o erro é parecido para todas, e a ordem não
 * muda.
 */
async function coordenadaDoEndereco(rua, cidade, uf) {
    if (!rua) return null;

    const busca = [rua, cidade, uf].filter(Boolean).join(", ");

    try {
        const u = "https://nominatim.openstreetmap.org/search?format=json&limit=1"
                + "&countrycodes=br&q=" + encodeURIComponent(busca);

        // Mais folga que o CEP: o Nominatim é gratuito e compartilhado, e
        // passar de 4 segundos é comum. Com o prazo curto, endereço certo
        // voltava como "não achei".
        const r = await fetch(u, { headers: { Accept: "application/json" }, signal: prazoCurto(10000) });
        if (!r.ok) return null;

        const j = await r.json();
        if (!j.length) return null;

        // Mesma desconfiança do CEP: se a resposta não fala da cidade
        // esperada, é outra rua de mesmo nome em outro lugar.
        if (cidade && !achatar(j[0].display_name).includes(achatar(cidade))) return null;

        return { lat: Number(j[0].lat), lng: Number(j[0].lon), como: "endereco", escrito: j[0].display_name };
    } catch (e) {
        console.warn("Não consegui a coordenada do endereço:", e);
        return null;
    }
}


/**
 * Tenta o CEP e depois o nome da rua. É a ordem certa: CEP de rua
 * devolve o trecho exato, e é mais barato que uma busca por texto.
 */
async function ondeFica({ cep, rua, cidade, uf }) {
    const peloCep = await coordenadaDoCep(cep, cidade);
    if (peloCep) return peloCep;

    return await coordenadaDoEndereco(rua, cidade, uf);
}
