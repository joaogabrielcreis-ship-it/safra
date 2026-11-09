// Avisos no celular (Web Push), no mesmo esquema do Fila e do Grifo.
// O pg_cron chama POST /notify uma vez por dia com o header x-cron-key; aqui se decide o que mandar:
//   1. no dia seguinte a um "bebi" sem nota: "Como estava o X?" (abre a tela de nota)
//   2. aos domingos: resumo da adega e uma sugestão do que abrir
// Inscrições e chaves ficam nas tabelas safra_push_subs / safra_config do Supabase (via REST).
import { env } from "./env.js";
import { listAll } from "./cellar.js";
import { janelaDe, urgencia } from "./janela.js";

const APP_URL = "https://joaogabrielcreis-ship-it.github.io/safra/";
const TZ = "America/Sao_Paulo";

/* ---------- armazenamento (PostgREST do Supabase, com a service role) ---------- */
const mem = { config: new Map(), subs: new Map(), log: [] };     // servidor local sem Supabase
const hasDb = () => !!(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
async function rest(method, path, body, prefer) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
async function getConfig(key) {
  if (!hasDb()) return mem.config.get(key) ?? null;
  const rows = await rest("GET", `safra_config?key=eq.${encodeURIComponent(key)}&select=value`);
  return rows?.[0]?.value ?? null;
}
async function setConfig(key, value) {
  if (!hasDb()) return void mem.config.set(key, value);
  await rest("POST", "safra_config", { key, value }, "resolution=merge-duplicates");
}
const subs = {
  all: async () => (hasDb() ? rest("GET", "safra_push_subs?select=*") : [...mem.subs.values()]),
  put: async (s) => (hasDb() ? rest("POST", "safra_push_subs", s, "resolution=merge-duplicates") : mem.subs.set(s.endpoint, s)),
  del: async (endpoint) => (hasDb() ? rest("DELETE", `safra_push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`) : mem.subs.delete(endpoint)),
  ok: async (endpoint) => hasDb() && rest("PATCH", `safra_push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, { last_ok_at: new Date().toISOString() }),
};
async function wasSent(ref) {
  if (!hasDb()) return mem.log.some((l) => l.ref === ref);
  return ((await rest("GET", `safra_notify_log?ref=eq.${encodeURIComponent(ref)}&select=id&limit=1`)) || []).length > 0;
}
async function logSent(kind, ref, msg) {
  const row = { kind, ref, title: msg.title, body: msg.body, url: msg.url };
  if (!hasDb()) return void mem.log.push(row);
  await rest("POST", "safra_notify_log", row);
}

/* ---------- Web Push (RFC 8291 aes128gcm + VAPID), só WebCrypto — igual ao Fila e ao Grifo ---------- */
const b64u = {
  enc: (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const te = new TextEncoder();
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}
async function encryptPush(p256dh, auth, payload) {
  const ua = b64u.dec(p256dh), sec = b64u.dec(auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(sec, shared, cat(te.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(te.encode(payload), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct);
}
async function vapid() {
  let pub = await getConfig("vapid_public"), priv = await getConfig("vapid_private");
  if (!pub || !priv) {
    const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    pub = b64u.enc(new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey)));
    priv = JSON.stringify(await crypto.subtle.exportKey("jwk", k.privateKey));
    await setConfig("vapid_public", pub);
    await setConfig("vapid_private", priv);
  }
  return { pub, priv };
}
async function vapidAuth(endpoint, pub, privJwk) {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(privJwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const h = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u.enc(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: APP_URL })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(`${h}.${c}`)));
  return `vapid t=${h}.${c}.${b64u.enc(sig)}, k=${pub}`;
}
async function pushAll(msg) {
  const list = (await subs.all()) || [];
  const out = { sent: 0, subs: list.length, errors: [] };
  if (!list.length) return out;
  const { pub, priv } = await vapid();
  for (const s of list) {
    try {
      const r = await fetch(s.endpoint, {
        method: "POST",
        headers: { Authorization: await vapidAuth(s.endpoint, pub, priv), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "43200", Urgency: "normal" },
        body: await encryptPush(s.p256dh, s.auth, JSON.stringify(msg)),
      });
      if (r.status === 404 || r.status === 410) await subs.del(s.endpoint);
      else if (r.ok) { out.sent++; await subs.ok(s.endpoint); }
      else out.errors.push(`${r.status} ${(await r.text()).slice(0, 160)}`);
    } catch (e) { out.errors.push(String(e).slice(0, 160)); }
  }
  return out;
}

/* ---------- rotas ---------- */
export async function publicKey() { return { key: (await vapid()).pub }; }
export async function subscribe({ subscription: s }) {
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) throw Object.assign(new Error("Inscrição inválida."), { status: 400 });
  await subs.put({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth });
  return { ok: true };
}
export async function unsubscribe({ endpoint }) { if (endpoint) await subs.del(endpoint); return { ok: true }; }
export async function test() {
  return pushAll({ title: "Safra", body: "Avisos ligados. Você vai receber a nota do dia seguinte e o resumo de domingo.", url: APP_URL, tag: "safra-teste" });
}

function localNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, sunday: p.weekday === "Sun" };
}
const open = (target) => `${APP_URL}?open=${encodeURIComponent(target)}`;

export async function checkCron(key) {
  const want = await getConfig("cron_key");
  return !!want && key === want;
}
export async function tick() {
  const { date, sunday } = localNow();
  const { wines } = await listAll();
  const back = (d) => new Date(new Date(date) - d * 864e5).toISOString().slice(0, 10);
  // 1. nota do que foi bebido nos últimos dias
  const semNota = wines.filter((w) => w.tag === "Had" && w.had && w.had >= back(3) && w.had < date && !w.nota).sort((a, b) => b.had.localeCompare(a.had));
  for (const w of semNota) {
    if (await wasSent(`nota:${w.id}`)) continue;
    const msg = { title: "Como estava?", body: `${w.n}${w.ppl?.length ? `, com ${w.ppl.join(", ")}` : ""}. Toque para dar a nota.`, url: open(`nota:${w.id}`), tag: `nota-${w.id}` };
    const r = await pushAll(msg);
    await logSent("nota", `nota:${w.id}`, msg);
    return { kind: "nota", ...r };
  }
  // 2. resumo de domingo
  if (sunday && !(await wasSent(`semana:${date}`))) {
    const cel = wines.filter((w) => w.tag === "Cellar").map((w) => ({ ...w, j: janelaDe(w) }));
    const gar = (st) => cel.filter((w) => w.j?.status === st).reduce((s, w) => s + Math.max(1, w.b || 1), 0);
    const top = cel.filter((w) => w.j).sort((a, b) => urgencia(a.j) - urgencia(b.j))[0];
    const parts = [gar("passou") && `${gar("passou")} passaram do ponto`, gar("ultimo") && `${gar("ultimo")} nos últimos anos`].filter(Boolean);
    const msg = {
      title: "A adega nesta semana",
      body: `${parts.length ? parts.join(", ") + "." : "Nada passando do ponto."}${top ? ` Sugestão: ${top.n}${top.pos?.length ? ` (${top.pos[0]})` : ""}.` : ""}`,
      url: open("abrir"), tag: "safra-semana",
    };
    const r = await pushAll(msg);
    await logSent("semana", `semana:${date}`, msg);
    return { kind: "semana", ...r };
  }
  return { kind: "nada" };
}
