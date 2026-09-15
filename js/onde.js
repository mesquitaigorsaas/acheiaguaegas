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
 * O endereço de um CEP, para preencher o formulário sozinho.
 *
 * ViaCEP primeiro: é o que mais acerta nome de rua e bairro. A BrasilAPI
 * fica de reserva, porque um serviço gratuito fora do ar não pode travar
 * quem só quer pedir um botijão.
 *
 * Rua vazia é CEP da cidade inteira, comum em cidade pequena: a cidade e
 * o estado vêm, e a rua a pessoa escreve.
 */
async function enderecoDoCep(cep) {
    const so = String(cep || "").replace(/\D/g, "");
    if (so.length !== 8) return null;

    try {
        const r = await fetch("https://viacep.com.br/ws/" + so + "/json/", { signal: prazoCurto(6000) });
        if (r.ok) {
            const j = await r.json();
            // O ViaCEP respondeu e disse que o CEP não existe. Perguntar
            // de novo à BrasilAPI só atrasaria a mesma resposta.
            if (!j || j.erro) return null;
            return { rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" };
        }
    } catch (e) {
        console.warn("ViaCEP não respondeu:", e);
    }

    try {
        const r = await fetch("https://brasilapi.com.br/api/cep/v1/" + so, { signal: prazoCurto(6000) });
        if (!r.ok) return null;

        const j = await r.json();
        return { rua: j.street || "", bairro: j.neighborhood || "", cidade: j.city || "", uf: j.state || "" };
    } catch (e) {
        console.warn("CEP sem endereço:", e);
        return null;
    }
}


/**
 * A coordenada de um endereço escrito.
 *
 * O mapa gratuito não conhece a numeração da maioria das ruas do Brasil:
 * com ou sem número, devolve o mesmo punhado de TRECHOS da rua. Numa
 * avenida comprida isso é o problema inteiro — a Raja Gabaglia, em BH,
 * volta em quase trinta pedaços espalhados por dez bairros, e ficar com
 * o primeiro punha o pino em Santa Lúcia para quem mora no São Bento.
 *
 * Quem escolhe o trecho é o BAIRRO, que o CEP já preencheu:
 *   1. o trecho que o mapa diz ser daquele bairro;
 *   2. se o nome não bate, o trecho mais perto do centro do bairro;
 *   3. sem bairro, ou sem o bairro no mapa, o primeiro trecho.
 *
 * O bairro não vai DENTRO da busca: quando o mapa discorda do nome que a
 * pessoa escreveu — "Rua Geraldo Freitas da Costa, Vila Teixeira,
 * Alfenas" —, a busca não acha nada. Por isso ele só escolhe entre o que
 * voltou.
 */
async function coordenadaDoEndereco(rua, cidade, uf, bairro) {
    if (!rua) return null;

    const trechos = await buscarNoMapa([rua, cidade, uf].filter(Boolean).join(", "), cidade, 40);
    if (!trechos.length) return null;

    const escolhido = bairro ? await trechoDoBairro(trechos, bairro, cidade, uf) : null;
    const t = escolhido || trechos[0];

    return { lat: t.lat, lng: t.lng, como: "endereco", escrito: t.escrito };
}


async function trechoDoBairro(trechos, bairro, cidade, uf) {
    const alvo = achatar(bairro).trim();

    // O segundo pedaço do nome é o bairro: "Avenida X, São Bento, ...".
    const doBairro = trechos.find((t) => achatar(t.escrito.split(",")[1]).trim() === alvo);
    if (doBairro) return doBairro;

    const [centro] = await buscarNoMapa([bairro, cidade, uf].filter(Boolean).join(", "), cidade, 1);
    if (!centro) return null;

    // Graus ao quadrado bastam para achar o mais perto: dentro de uma
    // cidade, a curvatura da Terra não muda qual trecho ganha.
    const longe = (t) => (t.lat - centro.lat) ** 2 + (t.lng - centro.lng) ** 2;
    return trechos.reduce((melhor, t) => (longe(t) < longe(melhor) ? t : melhor));
}


/** Os lugares que o mapa acha para um texto, só os da cidade esperada. */
async function buscarNoMapa(busca, cidade, quantos) {
    try {
        const u = "https://nominatim.openstreetmap.org/search?format=json&limit=" + quantos
                + "&countrycodes=br&q=" + encodeURIComponent(busca);

        // Mais folga que o CEP: o Nominatim é gratuito e compartilhado, e
        // passar de 4 segundos é comum. Com o prazo curto, endereço certo
        // voltava como "não achei".
        const r = await fetch(u, { headers: { Accept: "application/json" }, signal: prazoCurto(10000) });
        if (!r.ok) return [];

        const j = await r.json();

        // Mesma desconfiança do CEP: resposta que não fala da cidade
        // esperada é outra rua de mesmo nome em outro lugar.
        return j
            .filter((l) => !cidade || achatar(l.display_name).includes(achatar(cidade)))
            .map((l) => ({ lat: Number(l.lat), lng: Number(l.lon), escrito: l.display_name }));
    } catch (e) {
        console.warn("Não consegui a coordenada do endereço:", e);
        return [];
    }
}


/**
 * Tenta o nome da rua e, só se ele falhar, o CEP.
 *
 * Já foi o contrário, e estava errado: para muito CEP a BrasilAPI dá a
 * coordenada do centro da cidade, e não a da rua — o mesmo ponto no
 * centro de BH para CEPs a quilômetros um do outro. A lista inteira
 * media a distância de lá. O CEP fica para quando não há rua escrita,
 * ou quando o mapa não conhece a rua.
 */
async function ondeFica({ cep, rua, bairro, cidade, uf }) {
    const peloEndereco = await coordenadaDoEndereco(rua, cidade, uf, bairro);
    if (peloEndereco) return peloEndereco;

    return await coordenadaDoCep(cep, cidade);
}
