// web/dist를 내 컴퓨터에서 미리 보는 작은 정적 서버(외부 라이브러리 없음).
// 사용법: node web/scripts/serve.mjs  → http://localhost:4173
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "../dist");
const port = Number(process.env.PORT) || 4173;
const types = {
    ".html": "text/html; charset=utf-8", ".css": "text/css", ".mjs": "text/javascript", ".js": "text/javascript",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain",
};

createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([\\/])+/, "");
    let file = join(dist, path);
    if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
    try {
        if ((await stat(file)).isDirectory()) file = join(file, "index.html");
        res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
    } catch {
        res.writeHead(404, { "Content-Type": types[".html"] }).end(await readFile(join(dist, "404.html")).catch(() => "404"));
    }
}).listen(port, () => console.log(`http://localhost:${port}`));
