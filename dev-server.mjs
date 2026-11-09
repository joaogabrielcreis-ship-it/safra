// Servidor local: serve docs/ e roteia /api/* para as mesmas rotas da função do Supabase.
// npm run demo  → dados de exemplo em memória (senha: demo)
// npm run dev   → Notion de verdade, lendo NOTION_TOKEN e CELLAR_PIN do .env
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { handle } from "./server/router.js";
import { setBackend } from "./server/cellar.js";

if (existsSync(".env")) for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
if (process.env.DEMO === "1") setBackend(await import("./server/fake-notion.js"));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const PORT = +process.env.PORT || 5173;
const root = join(process.cwd(), "docs");

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    let body = {};
    if (req.method === "POST") { const ch = []; for await (const c of req) ch.push(c); try { body = JSON.parse(Buffer.concat(ch).toString() || "{}"); } catch {} }
    const out = await handle({ method: req.method, path: url.pathname.slice(4), pin: req.headers["x-cellar-pin"], cron: req.headers["x-cron-key"], body });
    res.writeHead(out.status, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(out.body));
  }
  let p = normalize(join(root, url.pathname));
  if (!p.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try { if ((await stat(p)).isDirectory()) p = join(p, "index.html"); } catch { p = join(root, "index.html"); }
  try {
    const body = await readFile(p);
    res.setHeader("Content-Type", TYPES[extname(p)] || "application/octet-stream");
    res.end(body);
  } catch { res.statusCode = 404; res.end("not found"); }
}).listen(PORT, () => console.log(`Cellar em http://localhost:${PORT} ${process.env.DEMO === "1" ? "(DEMO, senha: demo)" : ""}`));
