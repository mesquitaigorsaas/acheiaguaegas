// Servidor estático só para ver o site durante o desenvolvimento.
// Não faz parte do produto: o site publicado é HTML puro no GitHub Pages.

const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PORTA = 4620;

const TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
};

http.createServer((req, res) => {
    const semQuery = decodeURIComponent(req.url.split("?")[0]);
    const relativo = semQuery === "/" ? "/index.html" : semQuery;
    const arquivo = path.join(RAIZ, relativo);

    // Não deixa sair da pasta do projeto.
    if (!arquivo.startsWith(RAIZ)) {
        res.writeHead(403).end("Fora da pasta do projeto");
        return;
    }

    fs.readFile(arquivo, (erro, conteudo) => {
        if (erro) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Não encontrei: " + relativo);
            return;
        }
        res.writeHead(200, {
            "Content-Type": TIPOS[path.extname(arquivo).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        res.end(conteudo);
    });
}).listen(PORTA, () => console.log("Achei Água & Gás em http://localhost:" + PORTA));
