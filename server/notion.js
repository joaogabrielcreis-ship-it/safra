// Cliente mínimo da API REST do Notion (sem SDK, para não ter dependências).
// Usa a versão 2025-09-03, que trabalha com data sources.

import { env } from "./env.js";
const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03";

export const DS_CELLAR = env("CELLAR_DATA_SOURCE") || "be11237b-05a7-4986-9172-19dfe5aa1fa0";
export const DS_TRIPS = env("TRIPS_DATA_SOURCE") || "3dad968c-1a42-43f1-9700-c7d20eb7b693";

export class NotionError extends Error {
  constructor(status, body) {
    super((body && body.message) || `Notion respondeu ${status}`);
    this.status = status;
    this.code = body && body.code;
  }
}

async function call(method, path, body, attempt = 0) {
  const token = env("CELLAR_NOTION_TOKEN") || env("NOTION_TOKEN");
  if (!token) throw new NotionError(500, { message: "NOTION_TOKEN não configurado no servidor." });
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // limite de taxa do Notion (~3 req/s): espera e tenta de novo
  if ((res.status === 429 || res.status >= 502) && attempt < 3) {
    const wait = Number(res.headers.get("retry-after") || 1) * 1000;
    await new Promise((r) => setTimeout(r, wait + 300 * attempt));
    return call(method, path, body, attempt + 1);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new NotionError(res.status, json);
  return json;
}

export async function queryAll(dataSourceId, extra = {}) {
  const out = [];
  let cursor;
  do {
    const page = await call("POST", `/data_sources/${dataSourceId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
      ...extra,
    });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

export const getDataSource = (id) => call("GET", `/data_sources/${id}`);
export const getPage = (id) => call("GET", `/pages/${id}`);
export const updatePage = (id, properties) => call("PATCH", `/pages/${id}`, { properties });
export const archivePage = (id) => call("PATCH", `/pages/${id}`, { in_trash: true });
export const createPage = (properties, icon) =>
  call("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: DS_CELLAR },
    properties,
    ...(icon ? { icon: { type: "emoji", emoji: icon } } : {}),
  });

// sobe um arquivo (foto do rótulo) para o Notion e devolve o id para usar numa propriedade "files"
export async function uploadFile(bytes, filename, contentType) {
  const up = await call("POST", "/file_uploads", { mode: "single_part", filename, content_type: contentType });
  const token = env("CELLAR_NOTION_TOKEN") || env("NOTION_TOKEN");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), filename);
  const res = await fetch(`${API}/file_uploads/${up.id}/send`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION }, body: form,
  });
  if (!res.ok) throw new NotionError(res.status, await res.json().catch(() => null));
  return up.id;
}

/* ---------- construtores de propriedades ---------- */
export const P = {
  title: (s) => ({ title: [{ text: { content: String(s).slice(0, 2000) } }] }),
  text: (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 2000) } }] : [] }),
  number: (n) => ({ number: n === "" || n == null || Number.isNaN(+n) ? null : +n }),
  select: (s) => ({ select: s ? { name: String(s) } : null }),
  multi: (a) => ({ multi_select: (a || []).filter(Boolean).map((name) => ({ name: String(name) })) }),
  status: (s) => ({ status: { name: s } }),
  date: (d) => ({ date: d ? { start: d } : null }),
  relation: (ids) => ({ relation: (ids || []).map((id) => ({ id })) }),
  url: (u) => ({ url: u || null }),
  files: (uploads) => ({ files: (uploads || []).map(([id, name]) => ({ type: "file_upload", file_upload: { id }, name })) }),
};

/* ---------- leitores de propriedades ---------- */
const plain = (rt) => (rt || []).map((t) => t.plain_text).join("");
export function read(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case "title": return plain(prop.title) || null;
    case "rich_text": return plain(prop.rich_text) || null;
    case "number": return prop.number;
    case "select": return prop.select ? prop.select.name : null;
    case "status": return prop.status ? prop.status.name : null;
    case "multi_select": return prop.multi_select.map((o) => o.name);
    case "date": return prop.date ? prop.date.start : null;
    case "relation": return prop.relation.map((r) => r.id.replace(/-/g, ""));
    case "url": return prop.url;
    case "created_time": return prop.created_time;
    case "files": return prop.files.map((f) => (f.type === "file" ? f.file.url : f.external && f.external.url)).filter(Boolean);
    default: return null;
  }
}
