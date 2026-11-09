// Notion de mentira, em memória, para rodar o app localmente sem token (DEMO=1).
// Lê fixtures/pages.json (gerado por tools/make-fixture.mjs) no formato da API real.
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const file = new URL("../fixtures/pages.json", import.meta.url);
const db = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { cellar: [], trips: [], schema: {} };
const byId = new Map([...db.cellar, ...db.trips].map((p) => [p.id.replace(/-/g, ""), p]));
const delay = () => new Promise((r) => setTimeout(r, 150));

export async function queryAll(ds) {
  await delay();
  return ds.startsWith("3dad") ? db.trips : db.cellar;
}
export async function getDataSource() { return { properties: db.schema }; }
export async function getPage(id) {
  const p = byId.get(id);
  if (!p) throw Object.assign(new Error("not found"), { status: 404 });
  return structuredClone(p);
}
function wrap(k, v, old) {
  // converte o valor de escrita no valor de leitura do mesmo tipo
  if ("title" in v) return { type: "title", title: v.title.map((t) => ({ plain_text: t.text.content })) };
  if ("rich_text" in v) return { type: "rich_text", rich_text: v.rich_text.map((t) => ({ plain_text: t.text.content })) };
  if ("multi_select" in v) return { type: "multi_select", multi_select: v.multi_select };
  if ("relation" in v) return { type: "relation", relation: v.relation };
  if ("files" in v) return { type: "files", files: [] };
  const t = Object.keys(v)[0];
  return { type: t, [t]: v[t] };
}
export async function updatePage(id, props) {
  await delay();
  const p = byId.get(id);
  for (const [k, v] of Object.entries(props)) p.properties[k] = wrap(k, v, p.properties[k]);
  return p;
}
export async function createPage(props) {
  await delay();
  const id = randomUUID();
  const p = { id, url: "https://www.notion.so/" + id.replace(/-/g, ""), created_time: new Date().toISOString(), properties: {} };
  for (const [k, v] of Object.entries(props)) p.properties[k] = wrap(k, v);
  db.cellar.push(p); byId.set(id.replace(/-/g, ""), p);
  return p;
}
export async function archivePage(id) {
  await delay();
  const p = byId.get(id.replace(/-/g, ""));
  if (p) p.in_trash = true;
  return p;
}
export async function uploadFile() { await delay(); return randomUUID(); }
