// Rotas do backend, iguais no servidor local (Node) e na função do Supabase (Deno).
//   GET  /health                 público: diz se a senha e o Notion estão configurados
//   GET  /wines                  vinhos + viagens
//   GET  /options                opções dos campos de seleção do Notion
//   POST /drink    {id, code, date, where, people, nota, comment}
//   POST /position {changes: [{id, add:[], remove:[]}]}
//   POST /wine     {name, ...}   cadastra garrafa
//   POST /scan     {images:[dataURL]}  cadastro automático por foto (IA)
//   POST /update   {id, fields}  completa/corrige campos
//   POST /undo     {type, ...}   desfaz "bebi", cadastro ou soma de garrafas
//   GET  /push/key · POST /push/subscribe · /push/unsubscribe · /push/test   avisos no celular
//   POST /notify                  só o pg_cron, com o header x-cron-key
// Todas, menos /health e /notify, exigem o header x-cellar-pin igual a CELLAR_PIN.
import { env } from "./env.js";
import { NotionError, DS_CELLAR, getDataSource } from "./notion.js";
import { listAll, options, drink, changePositions, create, update, undo } from "./cellar.js";
import { scan } from "./scan.js";
import * as push from "./push.js";

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return new Uint8Array(buf);
}
// comparação em tempo constante (sobre os hashes, que têm o mesmo tamanho)
async function pinOk(given) {
  const want = env("CELLAR_PIN");
  if (!want || !given) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(want)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const err = (status, msg) => Object.assign(new Error(msg), { status });

export async function handle({ method, path, pin, body, cron }) {
  try {
    if (path === "/notify" && method === "POST") {
      if (!cron || !(await push.checkCron(cron))) throw err(401, "Chave do agendador inválida.");
      return { status: 200, body: await push.tick() };
    }
    if (path === "/health") {
      const notionToken = !!(env("CELLAR_NOTION_TOKEN") || env("NOTION_TOKEN"));
      let notion = notionToken ? "ok" : "sem token";
      if (notionToken && env("DEMO") !== "1") {
        try { await getDataSource(DS_CELLAR); } catch (e) { notion = e.status === 404 ? "sem acesso à base Cellar" : e.status === 401 ? "token inválido" : "erro"; }
      }
      return { status: 200, body: { pin: !!env("CELLAR_PIN"), notion, ia: !!env("ANTHROPIC_API_KEY") } };
    }
    if (!env("CELLAR_PIN")) throw err(500, "CELLAR_PIN não configurado no servidor.");
    if (!(await pinOk(pin))) throw err(401, "Senha incorreta.");

    const route = `${method} ${path}`;
    let out;
    if (route === "GET /wines") out = await listAll();
    else if (route === "GET /options") out = await options();
    else if (route === "POST /drink") out = await drink(body);
    else if (route === "POST /wine") out = await create(body);
    else if (route === "POST /scan") out = await scan(body);
    else if (route === "POST /update") out = await update(body);
    else if (route === "POST /undo") out = await undo(body);
    else if (route === "GET /push/key") out = await push.publicKey();
    else if (route === "POST /push/subscribe") out = await push.subscribe(body);
    else if (route === "POST /push/unsubscribe") out = await push.unsubscribe(body);
    else if (route === "POST /push/test") out = await push.test();
    else if (route === "POST /position") {
      if (!Array.isArray(body.changes) || !body.changes.length) throw err(400, "Nada para mudar.");
      out = await changePositions(body.changes);
    } else throw err(404, "Rota inexistente.");
    return { status: 200, body: out };
  } catch (e) {
    if (e instanceof NotionError) {
      const msg = e.status === 404 || e.code === "object_not_found"
        ? "O Notion não encontrou a base. Confira se a integração foi conectada às bases Cellar e Travel Plans."
        : e.status === 401 ? "Token do Notion inválido." : `Notion: ${e.message}`;
      return { status: 502, body: { error: msg } };
    }
    if (!e.status) console.error(e);
    return { status: e.status || 500, body: { error: e.message || "Erro inesperado" } };
  }
}
