import { janelaDe, urgencia, JAN_LABEL, JAN_ORDER } from "./janela.js";
import { renderNum } from "./stats.js";

// No GitHub Pages fala com a função do Supabase; rodando local, com o servidor de desenvolvimento.
const API = location.hostname.endsWith("github.io")
  ? "https://khevvlkznbewbktlmryt.supabase.co/functions/v1/cellar/"
  : "/api/";

/* ================= estado ================= */
const S = {
  wines: [], trips: [], tripBy: new Map(), readAt: null, opts: null,
  view: "adega",
  f: { q: "", kind: null, status: null, zone: null, sort: "urg" },
  zone: "CLI", color: "tipo", move: null, flash: null,
};
const PIN_KEY = "cellar-pin", CACHE_KEY = "cellar-cache-v1", OPTS_KEY = "cellar-opts-v1";
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

/* ================= constantes ================= */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ZONES = {
  CLI: { label: "Climatizada", cols: 5, rows: 5, basket: 7 },
  AMB: { label: "Ambiente", profile: [6, 6, 6, 6, 6, 5, 4, 3, 3, 2, 2, 1, 1] },
};
const codeOf = (z, c, r) => `${z}-${LETTERS[c]}${r + 1}`;
function codesOf(z) {
  const Z = ZONES[z], out = [];
  if (Z.profile) Z.profile.forEach((h, c) => { for (let r = 0; r < h; r++) out.push(codeOf(z, c, r)); });
  else for (let r = 0; r < Z.rows; r++) for (let c = 0; c < Z.cols; c++) out.push(codeOf(z, c, r));
  for (let i = 0; i < (Z.basket || 0); i++) out.push(`${z}-CESTO${i + 1}`);
  return out;
}
const KIND_VAR = { Tinto: "--k-tinto", Branco: "--k-branco", Laranja: "--k-laranja", "Rosé": "--k-rose", Espumante: "--k-espumante", Fortificado: "--k-fortificado" };
const LIGHT_KINDS = new Set(["Branco", "Rosé", "Espumante"]);
const KIND_LIST = ["Tinto", "Branco", "Laranja", "Rosé", "Espumante", "Fortificado"];
const KIND_EN = { Tinto: "Red", Branco: "White", Laranja: "Orange", "Rosé": "Rosé", Espumante: "Sparkling", Fortificado: "Fortified" };
const ST_VAR = { passou: "--crit", ultimo: "--warn", ponto: "--good", guardar: "--keep" };
const PT = { Argentina: "Argentina", Spain: "Espanha", Portugal: "Portugal", France: "França", Brazil: "Brasil", Chile: "Chile", Italy: "Itália", "United States": "EUA",
  Germany: "Alemanha", China: "China", "South Africa": "África do Sul", Austria: "Áustria", Uruguay: "Uruguai", Israel: "Israel", Greece: "Grécia", Slovenia: "Eslovênia",
  Romania: "Romênia", Moldova: "Moldávia", Peru: "Peru", Croatia: "Croácia", "New Zealand": "Nova Zelândia", Mexico: "México", "Czech Republic": "Tchéquia",
  Slovakia: "Eslováquia", Australia: "Austrália", Hungary: "Hungria", Georgia: "Geórgia", Lebanon: "Líbano", Turkey: "Turquia", Switzerland: "Suíça", Albania: "Albânia",
  Bulgaria: "Bulgária", Serbia: "Sérvia", Japan: "Japão", Canada: "Canadá", "North Macedonia": "Macedônia do Norte", Montenegro: "Montenegro", "Bosnia and Herzegovina": "Bósnia" };
const FLAG = { Argentina: "🇦🇷", Spain: "🇪🇸", Portugal: "🇵🇹", France: "🇫🇷", Brazil: "🇧🇷", Chile: "🇨🇱", Italy: "🇮🇹", "United States": "🇺🇸", Germany: "🇩🇪", China: "🇨🇳",
  "South Africa": "🇿🇦", Austria: "🇦🇹", Uruguay: "🇺🇾", Israel: "🇮🇱", Greece: "🇬🇷", Slovenia: "🇸🇮", Romania: "🇷🇴", Moldova: "🇲🇩", Peru: "🇵🇪", Croatia: "🇭🇷",
  "New Zealand": "🇳🇿", Mexico: "🇲🇽", "Czech Republic": "🇨🇿", Slovakia: "🇸🇰", Australia: "🇦🇺", Hungary: "🇭🇺", Georgia: "🇬🇪", Lebanon: "🇱🇧", Turkey: "🇹🇷",
  Switzerland: "🇨🇭", Albania: "🇦🇱", Montenegro: "🇲🇪", "Bosnia and Herzegovina": "🇧🇦", Serbia: "🇷🇸", "North Macedonia": "🇲🇰", Bulgaria: "🇧🇬", Japan: "🇯🇵", Canada: "🇨🇦" };
const NOTAS = [["⭐️ ⭐️ ⭐️ ⭐️ ⭐️", "5"], ["⭐️ ⭐️ ⭐️ ⭐️½", "4½"], ["⭐️ ⭐️ ⭐️ ⭐️", "4"], ["⭐️ ⭐️ ⭐️½", "3½"], ["⭐️ ⭐️ ⭐️", "3"], ["⭐️ ⭐️", "2"], ["⭐️", "1"]];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ================= utilidades ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const brl = (v) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pais = (c) => c ? `${FLAG[c] || ""} ${PT[c] || c}`.trim() : "";
const nBottles = (w) => Math.max(1, w.b || 1);
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${+d} ${MESES[+m - 1]} ${y}`; };
const kindColor = (k) => `var(${KIND_VAR[k] || "--k-sem"})`;
const isCellar = (w) => w.tag === "Cellar";

// aviso no rodapé; com "action" ganha um botão (ex.: Desfazer) e fica mais tempo na tela
function toast(msg, err, action) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
  t.classList.toggle("err", !!err); t.classList.toggle("act", !!action); t.classList.add("on");
  if (action) $("button", t).onclick = () => { t.classList.remove("on"); action.fn(); };
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), action ? 7000 : err ? 4200 : 2400);
}
// desfaz pelo servidor e relê o Notion
async function undoOp(u, msg = "Desfeito") {
  try { await api("undo", u); toast(msg); } catch (e) { toast(e.message, true); }
  refresh(true);
}

/* ================= API ================= */
async function api(path, body) {
  const pin = store.get(PIN_KEY);
  let res;
  try {
    res = await fetch(API + path, {
      method: body ? "POST" : "GET",
      headers: { "x-cellar-pin": pin || "", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error(navigator.onLine ? "Não consegui falar com o servidor." : "Sem internet. Tente de novo quando conectar."), { net: true });
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(json.error); throw new Error(json.error || "Senha incorreta."); }
  if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
  return json;
}

/* ================= fila sem internet ================= */
// "Bebi" feito sem conexão fica guardado no aparelho e é enviado quando a internet volta (como no Grifo)
const OUTBOX_KEY = "safra-outbox-v1";
const outbox = { get: () => store.get(OUTBOX_KEY) || [], set: (v) => { store.set(OUTBOX_KEY, v); drawOutbox(); } };
function drawOutbox() {
  const n = outbox.get().length, el = $("#outbox");
  el.hidden = !n;
  el.innerHTML = `<svg class="i" viewBox="0 0 24 24"><path d="M3 3l18 18M8.5 8.5A5 5 0 0 0 6 18h11M17.5 12.5A4 4 0 0 1 20 16M12 6a6 6 0 0 1 5.6 4"/></svg>${n} ${n === 1 ? "registro esperando" : "registros esperando"} internet · tocar para enviar`;
}
let flushing = false;
async function flushOutbox() {
  if (flushing || !outbox.get().length) return;
  flushing = true;
  let sent = 0;
  try {
    for (const op of outbox.get()) {
      try { await api(op.path, op.body); sent++; }
      catch (e) {
        if (e.net) break;                                   // ainda sem rede: tenta depois
        toast(`${op.label}: ${e.message}`, true);           // o servidor recusou: não adianta repetir
      }
      outbox.set(outbox.get().filter((x) => x.opId !== op.opId));
    }
  } finally { flushing = false; }
  if (sent) { toast(sent === 1 ? "Registro enviado ao Notion" : `${sent} registros enviados ao Notion`); refresh(true); }
}
window.addEventListener("online", flushOutbox);

/* ================= dados ================= */
function setData(d) {
  S.wines = d.wines.map((w) => (isCellar(w) ? { ...w, j: janelaDe(w) } : w));
  S.trips = d.trips || [];
  S.tripBy = new Map(S.trips.map((t) => [t.id, t]));
  S.readAt = d.readAt;
}
const cellar = () => S.wines.filter(isCellar);
const byId = (id) => S.wines.find((w) => w.id === id);
function occupancy() {
  const m = new Map();
  for (const w of cellar()) for (const c of w.pos) if (!m.has(c)) m.set(c, w);
  return m;
}
const unplaced = (w) => Math.max(0, nBottles(w) - w.pos.length);

let refreshing = null;
async function refresh(quiet) {
  if (refreshing) return refreshing;
  setSync("busy");
  refreshing = (async () => {
    try {
      const d = await api("wines");
      setData(d); store.set(CACHE_KEY, d);
      setSync("ok"); render();
      if (!S.opts) loadOptions();
    } catch (e) {
      setSync("err");
      if (!quiet) toast(e.message, true);
    } finally { refreshing = null; }
  })();
  return refreshing;
}
async function loadOptions() {
  try { S.opts = await api("options"); store.set(OPTS_KEY, S.opts); } catch {}
}
function setSync(state) {
  const b = $("#syncBtn"); b.classList.toggle("busy", state === "busy"); b.classList.toggle("err", state === "err");
  b.dataset.state = state; syncLabel();
}
function syncText() {
  const st = $("#syncBtn").dataset.state;
  if (st === "busy") return "atualizando…";
  if (st === "err") return "sem conexão · última leitura " + (S.readAt ? fmtDate(S.readAt) : "—");
  if (!S.readAt) return "";
  const min = Math.round((Date.now() - new Date(S.readAt)) / 60000);
  return "Notion " + (min < 1 ? "agora" : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : fmtDate(S.readAt));
}
function syncLabel() {
  const garr = cellar().reduce((s, w) => s + nBottles(w), 0);
  const subs = {
    adega: [garr ? `${garr} garrafas` : "", syncText()],
    abrir: ["pela janela estimada de cada vinho"],
    mapa: ["toque num vão para ver ou mover"],
    num: ["o que entra, sai e fica"],
  };
  $("#viewSub").textContent = (subs[S.view] || []).filter(Boolean).join(" · ");
}

/* ================= login ================= */
// A chave pode vir no link (…/cellar/#k=…), como no Grifo e no Fila. O #k= fica no endereço de
// propósito: no iPhone, o app da Tela de Início tem armazenamento próprio, então o "Adicionar à
// Tela de Início" precisa guardar o endereço com a chave.
function keyFromLink() {
  const m = location.hash.match(/[#&]k=([^&]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}
function logout(msg) {
  store.del(PIN_KEY);
  // chave do link recusada: tira do endereço para não voltar a usá-la no próximo carregamento
  if (keyFromLink()) history.replaceState(null, "", location.pathname + location.search);
  $("#app").hidden = true; $("#login").hidden = false;
  $("#loginErr").textContent = msg && msg !== "Senha incorreta." ? msg : "";
}
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pin = $("#pin").value.trim(); if (!pin) return;
  const btn = e.submitter; btn.disabled = true; $("#loginErr").textContent = "";
  store.set(PIN_KEY, pin);
  try {
    const d = await api("wines");
    setData(d); store.set(CACHE_KEY, d);
    start();
  } catch (err) {
    store.del(PIN_KEY);
    $("#loginErr").textContent = err.message;
  } finally { btn.disabled = false; }
});

/* ================= navegação ================= */
const TITLES = { adega: "Adega", abrir: "Quando abrir", mapa: "Posições", num: "Números" };
function go(v, opts = {}) {
  S.view = v;
  $$(".tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  $$(".view").forEach((s) => (s.hidden = s.id !== "v-" + v));
  $("#viewTitle").textContent = TITLES[v];
  $("#bellBtn").hidden = v !== "adega";
  render();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}
$$(".tabbar button").forEach((b) => b.addEventListener("click", () => { if (b.dataset.v !== "mapa") S.move = null; go(b.dataset.v); }));
$("#syncBtn").addEventListener("click", () => refresh());
$("#newBtn").addEventListener("click", () => { haptic(); openNovo(); });
$("#bellBtn").addEventListener("click", openNotify);
$("#outbox").addEventListener("click", flushOutbox);
window.addEventListener("scroll", () => $(".head").classList.toggle("scrolled", window.scrollY > 8), { passive: true });

function render() {
  if (S.view === "adega") renderAdega();
  else if (S.view === "abrir") renderAbrir();
  else if (S.view === "mapa") renderMapa();
  else if (S.view === "num") renderNum($("#v-num"), H);
  syncLabel();
}

/* ================= componentes ================= */
function statusPill(w) {
  const j = w.j;
  if (!j) return `<span class="pill st-none">sem safra</span>`;
  return `<span class="pill st-${j.status}"><i></i>${JAN_LABEL[j.status]}</span>`;
}
function wineRow(w, opts = {}) {
  const meta = [w.w, w.s, pais(w.c)].filter(Boolean).join(" · ");
  const right = opts.had
    ? `<span class="qty">${fmtDate(w.had)}</span>${w.nota ? `<span class="qty">${esc(w.nota.replace(/⭐️ ?/g, "★").replace(/ /g, ""))}</span>` : ""}`
    : `${statusPill(w)}<span class="qty">${nBottles(w) > 1 ? `${nBottles(w)}× ` : ""}${w.pos.length ? `<span class="code codes">${esc(w.pos[0])}${w.pos.length > 1 ? ` +${w.pos.length - 1}` : ""}</span>` : `<span class="codes">sem lugar</span>`}</span>`;
  return `<button class="wine" data-id="${w.id}">
    ${bottleIcon(w)}
    <span><span class="nm">${esc(w.n)}</span><span class="meta">${esc(meta)}</span></span>
    <span class="side">${right}</span></button>`;
}
function bindRows(root) {
  $$(".wine", root).forEach((b) => b.addEventListener("click", () => openWine(byId(b.dataset.id))));
}
function chip(label, pressed, attrs = "", dot) {
  return `<button class="chip" aria-pressed="${!!pressed}" ${attrs}>${dot ? `<span class="dot" style="background:${dot}"></span>` : ""}${esc(label)}</button>`;
}
const bottleIcon = (w) => `<span class="bottle${LIGHT_KINDS.has(w.k) ? " light" : ""}" style="background:${kindColor(w.k)}"><svg viewBox="0 0 16 30"><path d="M6 1h4v7c0 1.5 4 3 4 7v12.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 27.5V15c0-4 4-5.5 4-7z"/></svg></span>`;
const searchBox = (val, ph) => `<div class="search glass"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
  <input type="search" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off" enterkeyhint="search"></div>`;
const matches = (w, q) => !q || norm([w.n, w.w, w.c, PT[w.c], w.s, ...(w.g || []), ...(w.reg || []), ...(w.pos || []), w.k, S.tripBy.get(w.t)?.n].join(" ")).includes(norm(q));

/* ================= ADEGA ================= */
function renderAdega() {
  const root = $("#v-adega");
  const all = cellar();
  if (!S.wines.length) { root.innerHTML = `<p class="empty">Carregando a adega…</p>`; return; }
  const f = S.f;
  let rows = all.filter((w) => matches(w, f.q)
    && (!f.kind || w.k === f.kind)
    && (!f.status || w.j?.status === f.status)
    && (!f.zone || (f.zone === "none" ? !w.pos.length : w.pos.some((c) => c.startsWith(f.zone)))));
  const sorters = {
    urg: (a, b) => urgencia(a.j) - urgencia(b.j) || a.n.localeCompare(b.n),
    nome: (a, b) => a.n.localeCompare(b.n),
    safra: (a, b) => (a.s || "9999").localeCompare(b.s || "9999"),
    preco: (a, b) => (b.v || 0) - (a.v || 0),
    novo: (a, b) => (b.ct || "").localeCompare(a.ct || ""),
  };
  rows.sort(sorters[f.sort]);
  const garrafas = all.reduce((s, w) => s + nBottles(w), 0);
  const cnt = (st) => all.filter((w) => w.j?.status === st).reduce((s, w) => s + nBottles(w), 0);
  const kinds = KIND_LIST.filter((k) => all.some((w) => w.k === k));
  const valor = all.reduce((s, w) => s + (w.v || 0) * nBottles(w), 0);
  const stTot = JAN_ORDER.map((st) => [st, cnt(st)]).filter(([, n]) => n);
  root.innerHTML = `
    ${f.q || f.kind || f.zone || f.status ? "" : `<div class="hero">
      <div class="big">${garrafas}</div><div class="lbl">garrafas em ${all.length} rótulos</div>
      <div class="statusbar">${stTot.map(([st, n]) => `<i style="width:${(n / garrafas) * 100}%;background:var(${ST_VAR[st]})"></i>`).join("")}</div>
      <div class="row">
        <div><b>${cnt("ponto") + cnt("ultimo")}</b>no ponto</div>
        <div><b>${cnt("passou")}</b>passaram</div>
        <div><b>${cnt("guardar")}</b>guardar</div>
        ${valor ? `<div><b>${brl(valor)}</b>na adega</div>` : ""}
      </div></div>`}
    ${f.q || f.kind || f.zone || f.status ? "" : completeCard()}
    <div style="height:12px"></div>
    ${searchBox(f.q, "Vinho, produtor, uva, país, vão…")}
    ${filterRow()}
    <div class="sect"><h2>${rows.length === all.length ? "Na adega" : "Resultado"}</h2><span>${rows.length} ${rows.length === 1 ? "rótulo" : "rótulos"}</span></div>
    ${rows.length ? `<div class="list">${rows.map((w) => wineRow(w)).join("")}</div>` : `<p class="empty">Nada encontrado.</p>`}`;
  const inp = $("input", root);
  inp.addEventListener("input", () => { S.f.q = inp.value; const pos = inp.selectionStart; renderAdega(); const ni = $("#v-adega input"); ni.focus(); ni.setSelectionRange(pos, pos); });
  bindFilterRow(root);
  $("#complete", root)?.addEventListener("click", () => openComplete());
  bindRows(root);
}

/* ================= FILTROS (um botão só, menos opções na tela) ================= */
const SORTS = [["urg", "Abrir primeiro"], ["nome", "Nome"], ["safra", "Safra"], ["preco", "Preço"], ["novo", "Recentes"]];
const ZONE_L = { CLI: "Climatizada", AMB: "Ambiente", none: "Sem posição" };
const activeFilters = () => [
  S.f.kind && { k: "kind", l: S.f.kind, dot: kindColor(S.f.kind) },
  S.f.zone && { k: "zone", l: ZONE_L[S.f.zone] },
  S.f.status && { k: "status", l: JAN_LABEL[S.f.status] },
].filter(Boolean);
function filterRow() {
  const act = activeFilters();
  return `<div class="chips" id="frow">
    <button class="chip filterbtn" id="fopen" aria-pressed="${act.length > 0}"><svg class="i" viewBox="0 0 24 24" style="width:17px;height:17px"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtros${act.length ? `<span class="n">${act.length}</span>` : ""}</button>
    ${act.map((a) => chip(`${a.l} ✕`, true, `data-clear="${a.k}"`, a.dot)).join("")}
    <button class="chip" id="fsort">${esc(SORTS.find(([k]) => k === S.f.sort)[1])} ▾</button>
  </div>`;
}
function bindFilterRow(root) {
  $("#fopen", root).onclick = () => openFilters();
  $("#fsort", root).onclick = () => openFilters();
  $$("[data-clear]", root).forEach((b) => b.onclick = () => { S.f[b.dataset.clear] = null; renderAdega(); });
}
function openFilters() {
  const all = cellar(), f = S.f;
  const kinds = KIND_LIST.filter((k) => all.some((w) => w.k === k));
  const n = all.filter((w) => (!f.kind || w.k === f.kind) && (!f.status || w.j?.status === f.status)
    && (!f.zone || (f.zone === "none" ? !w.pos.length : w.pos.some((c) => c.startsWith(f.zone))))).length;
  openSheet(`<p class="eyebrow">Adega</p><h2>Filtros</h2>
    <p class="fgroup">Tipo</p><div class="chips wrapchips">${chip("Todos", !f.kind, 'data-fk=""')}${kinds.map((k) => chip(k, f.kind === k, `data-fk="${k}"`, kindColor(k))).join("")}</div>
    <p class="fgroup">Onde está</p><div class="chips wrapchips">${chip("Qualquer lugar", !f.zone, 'data-fz=""')}${Object.entries(ZONE_L).map(([k, l]) => chip(l, f.zone === k, `data-fz="${k}"`)).join("")}</div>
    <p class="fgroup">Quando abrir</p><div class="chips wrapchips">${chip("Todos", !f.status, 'data-fs=""')}${JAN_ORDER.map((st) => chip(JAN_LABEL[st], f.status === st, `data-fs="${st}"`, `var(${ST_VAR[st]})`)).join("")}</div>
    <p class="fgroup">Ordenar por</p><div class="chips wrapchips">${SORTS.map(([k, l]) => chip(l, f.sort === k, `data-fo="${k}"`)).join("")}</div>
    <div class="btnrow" style="margin-top:20px"><button class="btn" id="fclear">Limpar</button><button class="btn primary" id="fdone">Ver ${n} ${n === 1 ? "rótulo" : "rótulos"}</button></div>`, (root) => {
    const set = (k, v) => { haptic(); f[k] = v || null; renderAdega(); openFilters(); };
    $$("[data-fk]", root).forEach((b) => b.onclick = () => set("kind", b.dataset.fk));
    $$("[data-fz]", root).forEach((b) => b.onclick = () => set("zone", b.dataset.fz));
    $$("[data-fs]", root).forEach((b) => b.onclick = () => set("status", b.dataset.fs));
    $$("[data-fo]", root).forEach((b) => b.onclick = () => { haptic(); f.sort = b.dataset.fo; renderAdega(); openFilters(); });
    $("#fclear", root).onclick = () => { Object.assign(f, { kind: null, zone: null, status: null, sort: "urg" }); renderAdega(); openFilters(); };
    $("#fdone", root).onclick = closeSheet;
  });
}

/* ================= QUANDO ABRIR ================= */
function renderAbrir() {
  const root = $("#v-abrir");
  const all = cellar();
  const groups = JAN_ORDER.map((st) => ({ st, rows: all.filter((w) => w.j?.status === st).sort((a, b) => urgencia(a.j) - urgencia(b.j)) }));
  const semSafra = all.filter((w) => !w.j);
  const HINT = {
    passou: "Pela estimativa já passaram da janela. Abra logo — muitos ainda estão bons.",
    ultimo: "Na reta final da janela: menos de um ano e meio pela frente.",
    ponto: "Dentro da janela, com folga.",
    guardar: "Ainda jovens para o estilo.",
  };
  root.innerHTML = tonightCard() + groups.map((g) => g.rows.length ? `
    <div class="sect"><h2><span class="pill st-${g.st}"><i></i>${JAN_LABEL[g.st]}</span></h2><span>${g.rows.reduce((s, w) => s + nBottles(w), 0)} garrafas</span></div>
    <p class="note" style="margin-top:-4px">${HINT[g.st]}</p>
    <div class="list">${g.rows.map((w) => wineRow(w)).join("")}</div>` : "").join("")
    + (semSafra.length ? `<div class="sect"><h2>Sem safra</h2><span>${semSafra.length}</span></div><div class="list">${semSafra.map((w) => wineRow(w)).join("")}</div>` : "")
    + `<p class="note">A janela é estimada pelo estilo do vinho — tipo, casta, região, safra, preço, nota, menções no rótulo, se é natural e onde a garrafa está guardada. Toque num vinho para ver o porquê.</p>`;
  bindRows(root);
  bindTonight(root, renderAbrir);
}

/* ================= FICHA ================= */
// vibração curta: Android usa vibrate; no iPhone (iOS 18+) tocar num switch escondido dá o "tique" do sistema
const haptic = (() => {
  let lab;
  return () => {
    try {
      if (navigator.vibrate) return void navigator.vibrate(8);
      if (!lab) {
        lab = document.createElement("label"); lab.setAttribute("aria-hidden", "true");
        lab.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0";
        const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
        lab.appendChild(i); document.body.appendChild(lab);
      }
      lab.click();
    } catch {}
  };
})();
let novoEl = null;                                       // o formulário de nova garrafa sobrevive a fechar a folha
function openSheet(html, onMount) {
  const sh = $("#sheet"), bg = $("#sheetBg");
  novoEl?.remove();
  $("#sheetBody").innerHTML = html;
  const m = $("main"); m.style.transformOrigin = `50% ${window.scrollY + innerHeight / 2}px`;
  document.body.classList.add("sheeted");
  sh.hidden = false; bg.hidden = false; sh.scrollTop = 0;
  requestAnimationFrame(() => { sh.classList.add("on"); bg.classList.add("on"); });
  document.body.style.overflow = "hidden";
  onMount && onMount($("#sheetBody"));
}
function closeSheet() {
  const sh = $("#sheet"), bg = $("#sheetBg");
  sh.classList.remove("on"); bg.classList.remove("on");
  document.body.classList.remove("sheeted");
  document.body.style.overflow = "";
  setTimeout(() => { if (!sh.classList.contains("on")) { sh.hidden = true; bg.hidden = true; } }, 260);
}
$("#sheetBg").addEventListener("click", closeSheet);
// arrastar a folha para baixo fecha
(() => {
  let y0 = null, dy = 0; const sh = $("#sheet");
  sh.addEventListener("touchstart", (e) => { if (sh.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sh.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transition = "none"; sh.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  sh.addEventListener("touchend", () => { if (y0 == null) return; sh.style.transition = ""; sh.style.transform = ""; if (dy > 110) { haptic(); closeSheet(); } y0 = null; });
})();
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

function janelaBlock(w) {
  const j = w.j;
  if (!j) return isCellar(w) ? `<div class="jan"><span class="pill st-none">sem safra</span><p class="note" style="margin:6px 0 0">Sem safra não dá para estimar a janela.</p></div>` : "";
  const a = Math.floor(j.anoIni), b = Math.ceil(j.anoFim);
  const lo = Math.min(j.safra || a, a) , hi = Math.max(b, new Date().getFullYear() + 1);
  const pct = (x) => ((x - lo) / (hi - lo)) * 100;
  const now = new Date().getFullYear() + new Date().getMonth() / 12;
  const txt = j.status === "guardar" ? `Começa a abrir em ${Math.round(j.anoIni)}` : j.status === "passou" ? `Janela até ~${Math.round(j.anoFim)}` : `Bom até ~${Math.round(j.anoFim)}`;
  return `<div class="jan">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${statusPill(w)}<span style="font-size:13px;color:var(--ink2)">${txt}</span></div>
    <div class="bar"><div class="win" style="left:${pct(j.anoIni)}%;width:${pct(j.anoFim) - pct(j.anoIni)}%"></div><div class="now" style="left:calc(${Math.min(100, pct(now))}% - 1px)"></div></div>
    <div class="years"><span>${lo}</span><span>${Math.round(j.anoIni)}–${Math.round(j.anoFim)}</span><span>${hi}</span></div>
    <details><summary>Por que essa janela</summary><ul>${j.porque.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></details></div>`;
}

function openWine(w, ctxCode) {
  if (!w) return;
  const trip = S.tripBy.get(w.t);
  const facts = [
    ["País", [pais(w.c), (w.reg || []).join(", ")].filter(Boolean).join(" · ")],
    ["Uvas", (w.g || []).join(", ")],
    ["Safra", w.s], ["Tipo", [w.k, w.nat ? "natural" : ""].filter(Boolean).join(", ")],
    ["Preço", w.v != null ? brl(w.v) : ""], ["Vivino", w.viv], ["Álcool", w.abv != null ? `${String(w.abv).replace(".", ",")}%` : ""],
    ["Viagem", trip ? trip.n : ""], ["Comprado", [w.bought, w.pur && fmtDate(w.pur)].filter(Boolean).join(" · ")],
    ...(isCellar(w) ? [] : [["Bebido", fmtDate(w.had)], ["Onde", w.ven], ["Com", (w.ppl || []).join(", ")], ["Nota", w.nota]]),
  ].filter(([, v]) => v != null && v !== "");
  const garr = nBottles(w);
  const posHtml = isCellar(w) ? `
    <div class="sect sm"><h2>Posição</h2><span>${garr} ${garr > 1 ? "garrafas" : "garrafa"}</span></div>
    <div class="posrow">
      ${w.pos.map((c) => `<button class="poschip" data-code="${c}"><span class="code">${c}</span><span style="font-size:12px;color:var(--ink2)">ver · mover</span></button>`).join("")}
      ${unplaced(w) ? (() => { const sg = suggestSlot(w); return `${sg ? `<button class="btn primary small" id="placeSug" data-code="${sg.code}">Guardar em ${sg.code}</button>` : ""}<button class="btn small" id="place">${sg ? "Outro vão" : w.pos.length ? `Posicionar mais ${unplaced(w)}` : "Escolher posição"}</button>`; })() : ""}
    </div>` : "";
  openSheet(`
    ${w.img ? `<div class="labelbox"><img class="labelimg" src="${esc(w.img)}" alt="" onerror="this.parentNode.hidden = true"></div>` : ""}
    <p class="eyebrow">${esc([w.k, pais(w.c)].filter(Boolean).join(" · ") || "Vinho")}</p>
    <h2>${esc(w.n)}</h2>
    <p class="sub">${esc([w.w, w.s].filter(Boolean).join(" · "))}</p>
    ${isCellar(w) ? `<button class="btn primary big" id="drink">Bebi esta garrafa</button>` : !w.nota ? `<button class="btn primary big" id="rate">Dar nota</button>` : ""}
    ${posHtml}
    ${janelaBlock(w)}
    <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${w.com ? `<div class="card"><p class="comment">${esc(w.com)}</p></div>` : ""}
    <div class="btnrow" style="margin-top:12px">
      <button class="btn ghost small" id="edit" type="button">Editar</button>
      <a class="btn ghost small" href="${esc(w.url)}" target="_blank" rel="noopener">Abrir no Notion</a>
      ${w.link ? `<a class="btn ghost small" href="${esc(w.link)}" target="_blank" rel="noopener">Vivino</a>` : ""}
    </div>`, (root) => {
    $("#drink", root)?.addEventListener("click", () => openDrink(w, ctxCode));
    $("#place", root)?.addEventListener("click", () => { closeSheet(); startMove(w, null); });
    $("#placeSug", root)?.addEventListener("click", (e) => { const c = e.currentTarget.dataset.code; closeSheet(); savePositions([{ id: w.id, add: [c] }], `Guardado em ${c}`); });
    $("#edit", root)?.addEventListener("click", () => openEdit(w));
    $("#rate", root)?.addEventListener("click", () => openEdit(w, { focus: "nota" }));
    $$(".poschip", root).forEach((b) => b.addEventListener("click", () => openSlotActions(w, b.dataset.code)));
  });
}

function openSlotActions(w, code) {
  openSheet(`
    <h2><span class="code" style="font-size:18px">${code}</span></h2>
    <p class="sub">${esc(w.n)}</p>
    <div class="form">
      <button class="btn" id="see">Ver no mapa</button>
      <button class="btn" id="mv">Mover para outro vão</button>
      <button class="btn" id="rm">Tirar desta posição</button>
      <button class="btn ghost" id="back">Voltar</button>
    </div>`, (root) => {
    $("#see", root).onclick = () => { closeSheet(); S.zone = code.slice(0, 3); S.flash = code; go("mapa"); };
    $("#mv", root).onclick = () => { closeSheet(); startMove(w, code); };
    $("#rm", root).onclick = async () => { closeSheet(); await savePositions([{ id: w.id, remove: [code] }], `${code} liberado`); };
    $("#back", root).onclick = () => openWine(w, code);
  });
}

/* ================= BEBI ================= */
function openDrink(w, ctxCode) {
  const people = S.opts?.people?.length ? S.opts.people : [...new Set(S.wines.flatMap((x) => x.ppl || []))].sort();
  const venues = [...new Set(S.wines.map((x) => x.ven).filter(Boolean))];
  const freq = new Map(); S.wines.forEach((x) => (x.ppl || []).forEach((p) => freq.set(p, (freq.get(p) || 0) + 1)));
  const topPeople = [...people].sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0)).slice(0, 10);
  let code = ctxCode && w.pos.includes(ctxCode) ? ctxCode : w.pos[w.pos.length - 1] || null;
  const sel = new Set(); let nota = "";
  openSheet(`
    <h2>Bebi esta garrafa</h2>
    <p class="sub">${esc(w.n)}${nBottles(w) > 1 ? ` · ficam ${nBottles(w) - 1} na adega` : " · última garrafa"}</p>
    <form class="form" id="df">
      ${w.pos.length > 1 ? `<div class="field"><label>De qual vão saiu</label><div class="tagpick" id="dcode">${w.pos.map((c) => chip(c, c === code, `type="button" data-c="${c}"`)).join("")}</div></div>` : ""}
      <div class="two">
        <div class="field"><label for="dd">Quando</label><input id="dd" type="date" value="${todayISO()}" required></div>
        <div class="field"><label for="dw">Onde</label><input id="dw" list="dvl" value="Casa" autocomplete="off"></div>
      </div>
      <datalist id="dvl">${venues.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>
      <div class="field"><label>Com quem</label>
        <div class="tagpick" id="dp">${topPeople.map((p) => chip(p, false, `type="button" data-p="${esc(p)}"`)).join("")}</div>
        <input id="dpx" list="dpl" placeholder="Outra pessoa…" style="margin-top:8px" autocomplete="off">
        <datalist id="dpl">${people.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>
      </div>
      <div class="field"><label>Nota</label><div class="stars" id="dn">${NOTAS.map(([v, l]) => `<button type="button" data-n="${v}" aria-pressed="false">${l}★</button>`).join("")}</div></div>
      <div class="field"><label for="dc">Comentário</label><textarea id="dc" placeholder="Como estava, com o que comeu…"></textarea></div>
      <p class="err" id="derr"></p>
      <div class="btnrow"><button class="btn" type="button" id="dx">Cancelar</button><button class="btn primary" type="submit">Registrar</button></div>
    </form>`, (root) => {
    $$("#dcode .chip", root).forEach((b) => b.onclick = () => { code = b.dataset.c; $$("#dcode .chip", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); });
    $$("#dp .chip", root).forEach((b) => b.onclick = () => { const p = b.dataset.p; sel.has(p) ? sel.delete(p) : sel.add(p); b.setAttribute("aria-pressed", sel.has(p)); });
    $$("#dn button", root).forEach((b) => b.onclick = () => { nota = nota === b.dataset.n ? "" : b.dataset.n; $$("#dn button", root).forEach((x) => x.setAttribute("aria-pressed", x.dataset.n === nota)); });
    $("#dx", root).onclick = () => openWine(w, ctxCode);
    $("#df", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true; btn.textContent = "Gravando…"; $("#derr", root).textContent = "";
      const extra = $("#dpx", root).value.split(",").map((x) => x.trim()).filter(Boolean);
      const body = { id: w.id, code, date: $("#dd", root).value, where: $("#dw", root).value.trim(), people: [...sel, ...extra], nota, comment: $("#dc", root).value.trim() };
      // a tela muda na hora; o Notion é gravado por trás (responder em menos de 400 ms)
      haptic();
      drankLocally(w, code, body);
      closeSheet();
      const queue = () => {
        outbox.set([...outbox.get(), { opId: crypto.randomUUID?.() || String(Date.now()), path: "drink", body, label: w.n, at: new Date().toISOString() }]);
        toast("Sem internet: guardado no celular, envio quando conectar.");
      };
      if (!navigator.onLine) return queue();
      toast("Saúde! Gravando no Notion…");
      try {
        const r = await api("drink", body);
        toast("Registrado no Notion. Saúde!", false, r.undo ? { label: "Desfazer", fn: () => undoOp(r.undo, "Bebida desfeita, garrafa de volta na adega") } : null);
        refresh(true);
      } catch (err) {
        if (err.net) return queue();
        toast(`Não gravou: ${err.message}`, true);
        refresh(true);                                    // volta a tela ao que está no Notion
      }
    });
  });
}

// aplica na tela o "bebi" que ficou na fila, para a adega não mostrar a garrafa que já saiu
function drankLocally(w, code, body) {
  const n = nBottles(w);
  const had = { ...w, id: "local-" + Date.now(), tag: "Had", had: body.date, ven: body.where, ppl: body.people, nota: body.nota || null, pos: [], b: 1, j: undefined };
  if (n > 1) { w.b = n - 1; w.pos = w.pos.filter((c) => c !== (code || w.pos[w.pos.length - 1])); w.j = janelaDe(w); S.wines.push(had); }
  else Object.assign(w, { tag: "Had", had: body.date, ven: body.where, ppl: body.people, nota: body.nota || null, pos: [], j: undefined });
  render();
}

/* ================= POSIÇÕES ================= */
function startMove(w, from) {
  S.move = { id: w.id, from };
  if (from) S.zone = from.slice(0, 3);
  go("mapa");
  toast(from ? `Toque no vão de destino para ${from}` : "Toque num vão livre");
}
async function savePositions(changes, okMsg) {
  haptic();
  // aplica já na tela e grava no Notion; se falhar, relê do Notion
  for (const ch of changes) {
    const w = byId(ch.id); if (!w) continue;
    w.pos = w.pos.filter((c) => !(ch.remove || []).includes(c));
    for (const c of ch.add || []) if (!w.pos.includes(c)) w.pos.push(c);
    if (w.j !== undefined) w.j = janelaDe(w);
  }
  render();
  try {
    await api("position", { changes });
    const inverse = changes.map((c) => ({ id: c.id, add: c.remove || [], remove: c.add || [] }));
    toast(okMsg || "Gravado no Notion", false, { label: "Desfazer", fn: () => savePositions(inverse, "Posição desfeita") });
  }
  catch (e) { toast(e.message, true); refresh(true); }
}
function onSlot(code, occ) {
  const here = occ.get(code);
  if (S.move) {
    const w = byId(S.move.id), from = S.move.from;
    S.move = null;
    if (!w || code === from) { render(); return; }
    if (here && here.id !== w.id) {
      if (!from) { toast(`${code} está ocupado — escolha um vão livre`, true); S.move = { id: w.id, from }; return; }
      savePositions([{ id: w.id, remove: [from], add: [code] }, { id: here.id, remove: [code], add: [from] }], `Trocados: ${from} ⇄ ${code}`);
    } else {
      savePositions([{ id: w.id, remove: from ? [from] : [], add: [code] }], from ? `${from} → ${code}` : `Colocado em ${code}`);
    }
    return;
  }
  if (here) openWine(here, code);
  else openPicker(code);
}
function openPicker(code) {
  const cand = cellar().slice().sort((a, b) => unplaced(b) - unplaced(a) || a.n.localeCompare(b.n));
  const draw = (q, root) => {
    const list = cand.filter((w) => matches(w, q)).slice(0, 60);
    $("#pl", root).innerHTML = list.length ? list.map((w) => `<button class="wine" data-id="${w.id}">
      <span class="bottle" style="background:${kindColor(w.k)}"></span>
      <span><span class="nm">${esc(w.n)}</span><span class="meta">${esc([w.s, pais(w.c)].filter(Boolean).join(" · "))}</span></span>
      <span class="side"><span class="qty">${unplaced(w) ? `${unplaced(w)} sem lugar` : esc(w.pos.join(", "))}</span></span></button>`).join("") : `<p class="empty">Nada encontrado.</p>`;
    $$("#pl .bottle", root).forEach((b) => b.outerHTML = bottleIcon(byId(b.closest(".wine").dataset.id)));
    $$("#pl .wine", root).forEach((b) => b.onclick = () => {
      const w = byId(b.dataset.id); closeSheet();
      if (unplaced(w)) savePositions([{ id: w.id, add: [code] }], `${w.n.slice(0, 30)} em ${code}`);
      else if (w.pos.length === 1) savePositions([{ id: w.id, remove: [w.pos[0]], add: [code] }], `${w.pos[0]} → ${code}`);
      else { S.move = null; toast(`Esse rótulo já está em ${w.pos.join(", ")}. Mova pelo vão de origem.`, true); }
    });
  };
  openSheet(`<h2>Vão <span class="code" style="font-size:18px">${code}</span> livre</h2>
    <p class="sub">Escolha o vinho que vai aqui. Os que ainda não têm lugar aparecem primeiro.</p>
    ${searchBox("", "Buscar vinho…")}<div class="list" id="pl"></div>`, (root) => {
    const inp = $("input", root); draw("", root);
    inp.addEventListener("input", () => draw(inp.value, root));
  });
}

function slotHtml(code, w, extraClass = "", style = "") {
  const mv = S.move;
  let cls = "slot " + extraClass, bg = "";
  if (w) {
    const st = w.j?.status;
    const col = S.color === "tipo" ? kindColor(w.k) : st ? `var(${ST_VAR[st]})` : "var(--k-sem)";
    cls += " full" + (S.color === "tipo" && LIGHT_KINDS.has(w.k) ? " light" : "");
    bg = `background:${col};`;
    if (mv && mv.id === w.id && mv.from === code) cls += " sel";
    if (S.f.hl && !matches(w, S.f.hl)) cls += " dim";
  } else if (mv) cls += " target";
  if (S.flash === code) cls += " flash";
  const short = w ? w.n.replace(/\b(Vinho|Wine|Vino)\b/gi, "").trim() : "";
  return `<button class="${cls}" data-code="${code}" style="${bg}${style}" aria-label="${code}${w ? ": " + esc(w.n) : " livre"}">
    <span class="c">${code.replace(/^(CLI|AMB)-/, "").replace("CESTO", "C")}</span>${w && !extraClass.includes("hex") ? `<span class="w">${esc(short)}</span>` : ""}</button>`;
}

function renderMapa() {
  const root = $("#v-mapa");
  const occ = occupancy();
  const z = S.zone, Z = ZONES[z];
  const codes = codesOf(z);
  const used = codes.filter((c) => occ.has(c)).length;
  const semLugar = cellar().reduce((s, w) => s + unplaced(w), 0);
  const mvW = S.move && byId(S.move.id);
  let rack = "";
  if (!Z.profile) {
    rack = `<div class="rack"><span></span>${[...Array(Z.cols)].map((_, c) => `<span class="lab">${LETTERS[c]}</span>`).join("")}`;
    for (let r = Z.rows - 1; r >= 0; r--) {
      rack += `<span class="lab">${r + 1}</span>`;
      for (let c = 0; c < Z.cols; c++) { const code = codeOf(z, c, r); rack += slotHtml(code, occ.get(code)); }
    }
    rack += `</div><div class="basket"><div class="cap">Cesto do fundo</div><div class="row">${[...Array(Z.basket)].map((_, i) => { const code = `${z}-CESTO${i + 1}`; return slotHtml(code, occ.get(code)); }).join("")}</div></div>`;
  } else rack = `<div class="hexscroll" id="hexscroll"><div class="hexwrap" id="hexwrap"></div><div class="hexcols" id="hexcols"></div></div>`;

  const legend = S.color === "tipo"
    ? KIND_LIST.map((k) => `<span><i style="background:${kindColor(k)}"></i>${k}</span>`).join("")
    : JAN_ORDER.map((s) => `<span><i style="background:var(${ST_VAR[s]})"></i>${JAN_LABEL[s]}</span>`).join("");
  root.innerHTML = `
    ${mvW ? `<div class="movebar"><span>${S.move.from ? `Movendo ${S.move.from}` : "Posicionando"}: ${esc(mvW.n.slice(0, 26))}${mvW.n.length > 26 ? "…" : ""}</span><button id="mvx">Cancelar</button></div>` : ""}
    <div class="seg glass">${Object.entries(ZONES).map(([k, v]) => `<button data-z="${k}" aria-pressed="${k === z}">${v.label}</button>`).join("")}</div>
    ${searchBox(S.f.hl || "", "Destacar vinho, uva, país…")}
    <div class="sect" style="margin-top:4px"><h2 style="font-size:15px">${Z.label}</h2><span>${used}/${codes.length} ocupados</span></div>
    ${rack}
    <div class="chips" style="margin-top:12px">${chip("Cor por tipo", S.color === "tipo", 'data-cm="tipo"')}${chip("Cor por quando abrir", S.color === "quando", 'data-cm="quando"')}</div>
    <div class="legend">${legend}</div>
    ${Z.profile ? `<p class="note">Embaixo da escada: a coluna A é a da parede; o número é a altura contando de baixo.</p>` : `<p class="note">A prateleira 1 é a de baixo, encostada no cesto.</p>`}
    ${semLugar ? `<div class="sect"><h2 style="font-size:15px">Sem posição</h2><span>${semLugar} garrafas</span></div>
      <div class="list">${cellar().filter(unplaced).map((w) => wineRow(w)).join("")}</div>
      <p class="note">Toque num vinho e em “Escolher posição”, ou toque num vão livre do desenho.</p>` : ""}`;

  if (Z.profile) drawHex(root, z, occ);
  $("#mvx", root)?.addEventListener("click", () => { S.move = null; renderMapa(); });
  $$(".seg button", root).forEach((b) => b.onclick = () => { S.zone = b.dataset.z; renderMapa(); });
  $$("[data-cm]", root).forEach((b) => b.onclick = () => { S.color = b.dataset.cm; renderMapa(); });
  const inp = $(".search input", root);
  inp.addEventListener("input", () => { S.f.hl = inp.value; const p = inp.selectionStart; renderMapa(); const ni = $("#v-mapa .search input"); ni.focus(); ni.setSelectionRange(p, p); });
  $$(".slot", root).forEach((b) => b.onclick = () => onSlot(b.dataset.code, occ));
  bindRows(root);
  if (S.flash) {
    const el = $(`.slot[data-code="${S.flash}"]`, root);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => { S.flash = null; }, 2600);
  }
}
function drawHex(root, z, occ) {
  const prof = ZONES[z].profile, n = prof.length;
  const host = $("#hexwrap", root), cols = $("#hexcols", root);
  // vão com pelo menos 46 px de largura (alvo de toque confortável); se não couber, o desenho rola de lado
  const avail = ($("#hexscroll", root)?.clientWidth || root.clientWidth || 340) - 32;
  const cw = Math.max(avail, 46 * (1 + 0.75 * (n - 1)));
  host.style.width = cols.style.width = cw + "px";
  const W = cw / (1 + 0.75 * (n - 1)), H = W * 0.8660254, GAP = 2.5;
  const off = (c) => (c % 2 ? H / 2 : 0);
  const totalH = Math.max(...prof.map((h, c) => h * H + off(c)));
  host.style.height = totalH + "px";
  let html = "";
  prof.forEach((h, c) => {
    for (let r = 0; r < h; r++) {
      const code = codeOf(z, c, r);
      html += slotHtml(code, occ.get(code), "hex", `width:${W - GAP}px;height:${H - GAP}px;left:${c * 0.75 * W + GAP / 2}px;top:${totalH - (r + 1) * H - off(c) + GAP / 2}px;`);
    }
  });
  host.innerHTML = html;
  cols.innerHTML = prof.map((_, c) => `<span style="left:${c * 0.75 * W}px;width:${W}px">${LETTERS[c]}</span>`).join("");
}

/* ================= NOVA GARRAFA ================= */
function tagField(id, label, options, ph) {
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" list="${id}-l" placeholder="${esc(ph)}" autocomplete="off" enterkeyhint="done">
    <datalist id="${id}-l">${(options || []).map((o) => `<option value="${esc(o)}">`).join("")}</datalist>
    <div class="tagpick" id="${id}-t"></div></div>`;
}
function bindTag(root, id) {
  const vals = [], inp = $("#" + id, root), box = $(`#${id}-t`, root);
  const draw = () => { box.innerHTML = vals.map((v, i) => chip(`${v} ✕`, true, `type="button" data-i="${i}"`)).join(""); $$(".chip", box).forEach((b) => b.onclick = () => { vals.splice(+b.dataset.i, 1); draw(); }); };
  const add = () => { inp.value.split(",").map((x) => x.trim()).filter(Boolean).forEach((v) => { if (!vals.includes(v)) vals.push(v); }); inp.value = ""; draw(); };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } });
  inp.addEventListener("change", add);
  return () => { add(); return vals; };
}
function openNovo() {
  if (!novoEl) { novoEl = document.createElement("div"); renderNovo(novoEl); }   // mantém o que foi digitado
  openSheet(`<p class="eyebrow">Adega</p><h2>Nova garrafa</h2><p class="sub">Por foto ou à mão, direto no Notion.</p>`, (root) => root.appendChild(novoEl));
}
function renderNovo(root) {
  const o = S.opts || store.get(OPTS_KEY) || {};
  const countries = (o.country?.length ? o.country : [...new Set(S.wines.map((w) => w.c).filter(Boolean))]).slice().sort((a, b) => (PT[a] || a).localeCompare(PT[b] || b));
  const grapes = o.grapes?.length ? o.grapes : [...new Set(S.wines.flatMap((w) => w.g))].sort();
  const regions = o.region?.length ? o.region : [...new Set(S.wines.flatMap((w) => w.reg))].sort();
  const wineries = [...new Set(S.wines.map((w) => w.w).filter(Boolean))].sort();
  const shops = [...new Set(S.wines.map((w) => w.bought).filter(Boolean))].sort();
  const occ = occupancy();
  const free = ["CLI", "AMB"].flatMap((z) => codesOf(z).filter((c) => !occ.has(c)));
  let kind = "Tinto", natural = false;
  root.innerHTML = `${scanCard()}
    <div class="section-title">Ou preencha à mão</div>
    <form class="form" id="nf" style="margin-top:6px">
      <div class="field"><label for="nn">Nome do vinho *</label><input id="nn" required placeholder="Ex.: Zuccardi Tito 2021" autocomplete="off"></div>
      <div class="field"><label for="nw">Produtor</label><input id="nw" list="nwl" autocomplete="off"><datalist id="nwl">${wineries.map((v) => `<option value="${esc(v)}">`).join("")}</datalist></div>
      <div class="field"><label>Tipo</label><div class="tagpick" id="nk">${KIND_LIST.map((k) => chip(k, k === kind, `type="button" data-k="${k}"`, kindColor(k))).join("")}${chip("Natural", false, 'type="button" id="nnat"')}</div></div>
      <div class="two">
        <div class="field"><label for="nc">País</label><select id="nc"><option value="">—</option>${countries.map((c) => `<option value="${esc(c)}">${esc(pais(c))}</option>`).join("")}</select></div>
        <div class="field"><label for="ns">Safra</label><input id="ns" type="number" inputmode="numeric" min="1900" max="2100" placeholder="2021"></div>
      </div>
      ${tagField("ng", "Uvas", grapes, "Malbec, Syrah…")}
      ${tagField("nr", "Região", regions, "Valle del Uco…")}
      <div class="three">
        <div class="field"><label for="nb">Garrafas</label><input id="nb" type="number" inputmode="numeric" min="1" value="1"></div>
        <div class="field"><label for="nv">Preço R$</label><input id="nv" type="number" inputmode="decimal" step="0.01" min="0"></div>
        <div class="field"><label for="nvi">Vivino</label><input id="nvi" type="number" inputmode="decimal" step="0.1" min="0" max="5"></div>
      </div>
      <div class="two">
        <div class="field"><label for="na">Álcool %</label><input id="na" type="number" inputmode="decimal" step="0.1" min="0" max="25"></div>
        <div class="field"><label for="npd">Data da compra</label><input id="npd" type="date" value="${todayISO()}"></div>
      </div>
      <div class="field"><label for="nba">Comprado em</label><input id="nba" list="nbal" autocomplete="off"><datalist id="nbal">${shops.map((v) => `<option value="${esc(v)}">`).join("")}</datalist></div>
      ${S.trips.length ? `<div class="field"><label for="nt">Viagem</label><select id="nt"><option value="">—</option>${S.trips.slice().reverse().map((t) => `<option value="${t.id}">${esc(t.n)}${t.d0 ? ` · ${t.d0.slice(0, 4)}` : ""}</option>`).join("")}</select></div>` : ""}
      <div class="field"><label for="np">Posição</label><select id="np"><option value="">Decidir depois</option>
        <optgroup label="Climatizada">${free.filter((c) => c.startsWith("CLI")).map((c) => `<option>${c}</option>`).join("")}</optgroup>
        <optgroup label="Ambiente">${free.filter((c) => c.startsWith("AMB")).map((c) => `<option>${c}</option>`).join("")}</optgroup></select><p class="note" id="nphint" style="margin:6px 4px 0"></p></div>
      <div class="field"><label for="ncm">Comentário</label><textarea id="ncm"></textarea></div>
      <p class="err" id="nerr"></p>
      <button class="btn primary" type="submit">Cadastrar no Notion</button>
    </form>`;
  const getG = bindTag(root, "ng"), getR = bindTag(root, "nr");
  bindScan(root);
  // posição sugerida conforme o tipo, a safra e o preço (até você escolher outra)
  let posTouched = false;
  const updSug = () => {
    if (posTouched) return;
    const sg = suggestSlot({ n: $("#nn", root).value, k: kind, s: $("#ns", root).value || null, v: +$("#nv", root).value || null, g: [], reg: [], kinds: [], pos: [], nat: natural });
    if (sg) { $("#np", root).value = sg.code; $("#nphint", root).textContent = `Sugerido: ${sg.why}.`; }
  };
  $("#np", root).addEventListener("change", () => { posTouched = true; $("#nphint", root).textContent = ""; });
  ["#ns", "#nv", "#nn"].forEach((sel) => $(sel, root).addEventListener("change", updSug));
  root.addEventListener("click", (e) => { if (e.target.closest("#nk")) setTimeout(updSug); });
  updSug();
  $$("#nk .chip[data-k]", root).forEach((b) => b.onclick = () => { kind = kind === b.dataset.k ? null : b.dataset.k; $$("#nk .chip[data-k]", root).forEach((x) => x.setAttribute("aria-pressed", x.dataset.k === kind)); });
  $("#nnat", root).onclick = (e) => { natural = !natural; e.currentTarget.setAttribute("aria-pressed", natural); };
  $("#nf", root).addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; btn.textContent = "Gravando…"; $("#nerr", root).textContent = "";
    const v = (id) => $("#" + id, root)?.value.trim() || "";
    const body = {
      name: v("nn"), winery: v("nw"), country: v("nc"), safra: v("ns"),
      kinds: [kind && KIND_EN[kind], natural && "Natural"].filter(Boolean),
      grapes: getG(), region: getR(), bottles: v("nb"), value: v("nv"), vivino: v("nvi"), abv: v("na"),
      purchase: v("npd"), boughtAt: v("nba"), trip: v("nt"), comment: v("ncm"), codes: v("np") ? [v("np")] : [],
    };
    try {
      const r = await api("wine", body);
      haptic();
      novoEl = null;
      toast("Garrafa cadastrada no Notion", false, { label: "Desfazer", fn: () => undoOp(r.undo, "Cadastro desfeito") });
      await refresh(true);
      go("adega");
      const w = byId(r.id); if (w) openWine(w);
    } catch (err) {
      $("#nerr", root).textContent = err.message; btn.disabled = false; btn.textContent = "Cadastrar no Notion";
    }
  });
}

/* ================= SUGESTÃO DE VÃO ================= */
// climatizada para guarda, brancos, laranjas, espumantes e garrafas caras; ambiente para tintos de beber logo
const COOL_KINDS = new Set(["Branco", "Espumante", "Rosé", "Laranja"]);
function suggestSlot(w, exclude = []) {
  const j = w.j !== undefined ? w.j : janelaDe(w);
  const cool = !j || j.status === "guardar" || COOL_KINDS.has(w.k) || (w.v || 0) >= 250;
  const occ = occupancy();
  for (const z of cool ? ["CLI", "AMB"] : ["AMB", "CLI"]) {
    const free = codesOf(z).filter((c) => !occ.has(c) && !exclude.includes(c));
    if (free.length) return { code: free[0], why: z === "CLI" ? (cool ? "climatizada: vinho de guarda ou que pede frio" : "climatizada: a ambiente está cheia") : (cool ? "ambiente: a climatizada está cheia" : "ambiente: tinto para beber logo") };
  }
  return null;
}

/* ================= O QUE ABRIR HOJE ================= */
const FOOD = {
  carne: { l: "Carne", kinds: { Tinto: 25, Fortificado: -10, Espumante: -10 }, grapes: ["Malbec", "Cabernet Sauvignon", "Syrah", "Tannat", "Tempranillo", "Plavac Mali", "Vranac", "Primitivo", "Touriga Nacional", "Cabernet Franc", "Carménère"] },
  massa: { l: "Massa", kinds: { Tinto: 15, Branco: 5 }, grapes: ["Sangiovese", "Barbera", "Pinot Noir", "Nebbiolo", "Montepulciano", "Garnacha/Grenache", "Merlot"] },
  peixe: { l: "Peixe", kinds: { Branco: 25, Espumante: 15, Laranja: 10, "Rosé": 10, Tinto: -15 }, grapes: ["Pinot Noir", "Chardonnay", "Sauvignon Blanc", "Riesling", "Albariño"] },
  queijo: { l: "Queijo", kinds: { Fortificado: 25, Laranja: 15, Tinto: 10, Branco: 5 }, grapes: [] },
  petisco: { l: "Petisco", kinds: { Espumante: 25, "Rosé": 15, Branco: 10, Laranja: 10 }, grapes: [] },
};
const BUDGET = { dia: { l: "Dia a dia", ok: (v) => v <= 150 }, bom: { l: "Algo bom", ok: (v) => v > 120 && v <= 300 }, especial: { l: "Especial", ok: (v) => v >= 250 } };
function pickTonight(o) {
  const out = [];
  for (const w of cellar()) {
    if (o.kind && w.k !== o.kind) continue;
    let sc = 0; const why = [];
    const st = w.j?.status;
    if (st === "passou") { sc += 40; why.push("passou do ponto: melhor abrir logo"); }
    else if (st === "ultimo") { sc += 30; why.push("nos últimos anos da janela"); }
    else if (st === "ponto") { sc += 15; why.push("no ponto"); }
    else if (st === "guardar") { sc -= 30; }
    const f = FOOD[o.food];
    if (f) {
      const kb = f.kinds[w.k] || 0; sc += kb;
      const gr = (w.g || []).find((g) => f.grapes.includes(g));
      if (gr) { sc += 10; why.push(`${gr} vai bem com ${f.l.toLowerCase()}`); }
      else if (kb > 10) why.push(`${w.k.toLowerCase()} combina com ${f.l.toLowerCase()}`);
    }
    const b = BUDGET[o.budget];
    if (b) { if (w.v == null) sc -= 5; else if (b.ok(w.v)) sc += 10; else sc -= 40; }
    if (!w.pos.length) sc -= 5;
    out.push({ w, sc, why });
  }
  return out.sort((a, b) => b.sc - a.sc || urgencia(a.w.j) - urgencia(b.w.j)).slice(0, 3);
}
function tonightCard() {
  const o = S.tonight || (S.tonight = { kind: null, food: null, budget: null });
  const picks = pickTonight(o);
  return `<div class="card tonight">
    <h3>O que abrir hoje</h3><p class="cap">Escolha o que quiser; o resto fica em aberto.</p>
    <div class="chips wrapchips" id="tk">${chip("Qualquer", !o.kind, 'data-tk=""')}${["Tinto", "Branco", "Laranja", "Espumante"].map((k) => chip(k, o.kind === k, `data-tk="${k}"`, kindColor(k))).join("")}</div>
    <div class="chips wrapchips" id="tf" style="margin-top:8px">${Object.entries(FOOD).map(([k, f]) => chip(f.l, o.food === k, `data-tf="${k}"`)).join("")}</div>
    <div class="chips wrapchips" id="tb" style="margin-top:8px">${Object.entries(BUDGET).map(([k, b]) => chip(b.l, o.budget === k, `data-tb="${k}"`)).join("")}</div>
    <div class="ranks" style="margin-top:10px">${picks.map((p, i) => `<button class="rank" data-id="${p.w.id}"><span class="n">${i + 1}</span><span style="min-width:0"><span class="t" style="display:block">${esc(p.w.n)}</span><span class="m" style="display:block;white-space:normal">${esc(p.why.slice(0, 2).join(" · ") || [p.w.k, pais(p.w.c)].filter(Boolean).join(" · "))}</span></span><span class="v">${p.w.pos[0] ? `<span class="code">${p.w.pos[0]}</span>` : "sem lugar"}${p.w.v ? `<small>${brl(p.w.v)}</small>` : ""}</span></button>`).join("") || `<p class="note">Nada com esses filtros.</p>`}</div>
  </div>`;
}
function bindTonight(root, rerender) {
  const o = S.tonight;
  $$("[data-tk]", root).forEach((b) => b.onclick = () => { o.kind = b.dataset.tk || null; rerender(); });
  $$("[data-tf]", root).forEach((b) => b.onclick = () => { o.food = o.food === b.dataset.tf ? null : b.dataset.tf; rerender(); });
  $$("[data-tb]", root).forEach((b) => b.onclick = () => { o.budget = o.budget === b.dataset.tb ? null : b.dataset.tb; rerender(); });
  $$(".tonight .rank", root).forEach((b) => b.onclick = () => openWine(byId(b.dataset.id)));
}

/* ================= COMPLETAR DADOS / EDITAR ================= */
const MISSING = [
  ["v", "preço", (w) => w.v == null], ["s", "safra", (w) => !w.s], ["viv", "Vivino", (w) => w.viv == null],
  ["g", "uvas", (w) => !(w.g || []).length], ["c", "país", (w) => !w.c], ["abv", "álcool", (w) => w.abv == null],
];
const missingOf = (w) => MISSING.filter(([, , f]) => f(w)).map(([, l]) => l);
function toRate() {
  const d60 = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  return S.wines.filter((w) => w.tag === "Had" && w.had && w.had >= d60 && !w.nota && !String(w.id).startsWith("local-")).sort((a, b) => b.had.localeCompare(a.had));
}
function completeCard() {
  const inc = cellar().filter((w) => missingOf(w).length), rate = toRate();
  if (!inc.length && !rate.length) return "";
  return `<button class="card cta" id="complete"><span class="cta-ico"><svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg></span>
    <span><strong>Completar dados</strong><span class="m">${[inc.length && `${inc.length} na adega com campos vazios`, rate.length && `${rate.length} ${rate.length === 1 ? "bebido sem nota" : "bebidos sem nota"}`].filter(Boolean).join(" · ")}</span></span></button>`;
}
function openComplete(tab = "adega") {
  const inc = cellar().filter((w) => missingOf(w).length).sort((a, b) => missingOf(b).length - missingOf(a).length);
  const rate = toRate();
  const list = tab === "nota" ? rate : inc;
  openSheet(`<p class="eyebrow">Completar dados</p><h2>O que falta</h2><p class="sub">Preço, safra e nota deixam a janela de consumo e os Números mais certos.</p>
    <div class="seg glass"><button data-ct="adega" aria-pressed="${tab === "adega"}">Na adega · ${inc.length}</button><button data-ct="nota" aria-pressed="${tab === "nota"}">Sem nota · ${rate.length}</button></div>
    ${list.length ? `<div class="list">${list.map((w) => `<button class="wine" data-id="${w.id}">${bottleIcon(w)}<span><span class="nm">${esc(w.n)}</span><span class="meta">${esc(tab === "nota" ? `bebido em ${fmtDate(w.had)}${w.ppl?.length ? ` · ${w.ppl.join(", ")}` : ""}` : "falta " + missingOf(w).join(", "))}</span></span><span class="side"><span class="qty">${tab === "nota" ? "dar nota" : "editar"}</span></span></button>`).join("")}</div>` : `<p class="empty">Tudo completo.</p>`}`, (root) => {
    $$("[data-ct]", root).forEach((b) => b.onclick = () => openComplete(b.dataset.ct));
    $$(".wine", root).forEach((b) => b.onclick = () => openEdit(byId(b.dataset.id), { back: () => openComplete(tab), focus: tab === "nota" ? "nota" : null }));
  });
}
function openEdit(w, { back, focus } = {}) {
  if (!w) return;
  const o = S.opts || {};
  const countries = (o.country?.length ? o.country : [...new Set(S.wines.map((x) => x.c).filter(Boolean))]).slice().sort((a, b) => (PT[a] || a).localeCompare(PT[b] || b));
  const isHad = !isCellar(w);
  let nota = w.nota || "";
  const orig = { name: w.n, winery: w.w || "", country: w.c || "", safra: w.s || "", value: w.v ?? "", vivino: w.viv ?? "", abv: w.abv ?? "", grapes: (w.g || []).join(", "), region: (w.reg || []).join(", "), link: w.link || "", comment: w.com || "" };
  openSheet(`<p class="eyebrow">${isHad ? "Bebido" : "Na adega"}</p><h2>${esc(w.n)}</h2><p class="sub">Só o que você mudar vai para o Notion.</p>
    <form class="form" id="ef">
      ${isHad ? `<div class="field"><label>Nota</label><div class="stars" id="en">${NOTAS.map(([v, l]) => `<button type="button" data-n="${v}" aria-pressed="${v === nota}">${l}★</button>`).join("")}</div></div>` : ""}
      <div class="field"><label for="e-name">Nome</label><input id="e-name" value="${esc(orig.name)}"></div>
      <div class="two"><div class="field"><label for="e-value">Preço R$</label><input id="e-value" type="number" inputmode="decimal" step="0.01" value="${esc(orig.value)}"></div>
        <div class="field"><label for="e-safra">Safra</label><input id="e-safra" inputmode="numeric" value="${esc(orig.safra)}"></div></div>
      <div class="two"><div class="field"><label for="e-vivino">Vivino</label><input id="e-vivino" type="number" inputmode="decimal" step="0.1" min="0" max="5" value="${esc(orig.vivino)}"></div>
        <div class="field"><label for="e-abv">Álcool %</label><input id="e-abv" type="number" inputmode="decimal" step="0.1" value="${esc(orig.abv)}"></div></div>
      <div class="field"><label for="e-country">País</label><select id="e-country"><option value="">—</option>${countries.map((c) => `<option value="${esc(c)}" ${c === orig.country ? "selected" : ""}>${esc(pais(c))}</option>`).join("")}</select></div>
      <div class="field"><label for="e-winery">Produtor</label><input id="e-winery" value="${esc(orig.winery)}"></div>
      <div class="field"><label for="e-grapes">Uvas (separadas por vírgula)</label><input id="e-grapes" value="${esc(orig.grapes)}"></div>
      <div class="field"><label for="e-region">Região</label><input id="e-region" value="${esc(orig.region)}"></div>
      <div class="field"><label for="e-link">Link do Vivino</label><input id="e-link" type="url" value="${esc(orig.link)}"></div>
      <div class="field"><label for="e-comment">Comentário</label><textarea id="e-comment">${esc(orig.comment)}</textarea></div>
      <p class="err" id="eerr"></p>
      <div class="btnrow"><button class="btn" type="button" id="ex">Voltar</button><button class="btn primary" type="submit">Salvar</button></div>
    </form>`, (root) => {
    $$("#en button", root).forEach((b) => b.onclick = () => { nota = nota === b.dataset.n ? "" : b.dataset.n; $$("#en button", root).forEach((x) => x.setAttribute("aria-pressed", x.dataset.n === nota)); });
    $("#ex", root).onclick = () => (back ? back() : openWine(w));
    if (focus && focus !== "nota") $(`#e-${focus}`, root)?.focus();
    $("#ef", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const fields = {};
      for (const k of Object.keys(orig)) { const v = $(`#e-${k}`, root).value.trim(); if (v !== String(orig[k])) fields[k] = ["grapes", "region"].includes(k) ? v.split(",").map((x) => x.trim()).filter(Boolean) : v; }
      if (isHad && nota !== (w.nota || "")) fields.nota = nota;
      if (!Object.keys(fields).length) return back ? back() : openWine(w);
      // aplica na tela já e grava por trás; se o Notion recusar, relê e avisa
      const num = (v) => (v === "" ? null : +v);
      Object.assign(w, {
        ...(fields.name != null && { n: fields.name }), ...(fields.winery != null && { w: fields.winery }), ...(fields.country != null && { c: fields.country || null }),
        ...(fields.safra != null && { s: fields.safra || null }), ...(fields.value != null && { v: num(fields.value) }), ...(fields.vivino != null && { viv: num(fields.vivino) }),
        ...(fields.abv != null && { abv: num(fields.abv) }), ...(fields.grapes && { g: fields.grapes }), ...(fields.region && { reg: fields.region }),
        ...(fields.link != null && { link: fields.link }), ...(fields.comment != null && { com: fields.comment }), ...(fields.nota != null && { nota: fields.nota || null }),
      });
      if (isCellar(w)) w.j = janelaDe(w);
      render();
      back ? back() : openWine(w);
      try { await api("update", { id: w.id, fields }); toast("Gravado no Notion"); }
      catch (err) { toast(`Não gravou: ${err.message}`, true); refresh(true); }
    });
  });
}

/* ================= CADASTRO POR FOTO ================= */
// reduz cada foto para ~1600 px em JPEG antes de mandar (bem menor e suficiente para ler o rótulo)
async function shrink(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(`Não consegui abrir ${file.name}.`);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
function scanCard() {
  return `<label class="card scan" id="scanBox">
    <input type="file" id="scanIn" accept="image/*" multiple hidden>
    <span class="scan-ico"><svg class="i" viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.5"/></svg></span>
    <span class="scan-t">Cadastrar por foto</span>
    <span class="scan-s">Tire ou escolha fotos dos rótulos (frente e verso, várias garrafas de uma vez). A IA lê, busca a nota no Vivino e grava no Notion.</span>
  </label><div id="scanOut"></div>`;
}
function bindScan(root) {
  const inp = $("#scanIn", root);
  inp.addEventListener("change", async () => {
    const files = [...inp.files].slice(0, 8); inp.value = "";
    if (!files.length) return;
    const out = $("#scanOut", root);
    if (!navigator.onLine) { toast("O cadastro por foto precisa de internet.", true); return; }
    out.innerHTML = `<div class="card scanning"><div class="thumbs">${files.map(() => `<i></i>`).join("")}</div><p><span class="spin"></span> Lendo ${files.length === 1 ? "o rótulo" : `${files.length} fotos`} e buscando no Vivino… pode levar até um minuto.</p></div>`;
    try {
      const images = await Promise.all(files.map(shrink));
      $$(".thumbs i", out).forEach((el, i) => (el.style.backgroundImage = `url(${images[i]})`));
      const r = await api("scan", { images });
      await refresh(true);
      drawScanResult(out, r);
    } catch (e) {
      out.innerHTML = `<div class="card"><p class="err" style="margin:0">${esc(e.message)}</p></div>`;
    }
  });
}
function drawScanResult(out, r) {
  const taken = [];
  out.innerHTML = `<div class="section-title">Cadastrados<span class="count">${r.items.length}</span></div>
    ${r.demo ? `<p class="note">Modo demonstração: sem chave da IA no servidor local, entrou um vinho de exemplo.</p>` : ""}
    <div class="stack">${r.items.map((it, i) => {
      const w = byId(it.id);
      const sug = w && it.action === "created" && unplaced(w) ? suggestSlot(w, taken) : null;
      if (sug) taken.push(sug.code);
      return `<div class="card result" data-i="${i}">
        <p class="eyebrow">${it.action === "added" ? `+${it.bottles} ${it.bottles > 1 ? "garrafas" : "garrafa"} num vinho que já estava na adega` : `${it.bottles > 1 ? `${it.bottles} garrafas` : "Novo"}`}</p>
        <h3 style="font-family:var(--serif)">${esc(it.name)}</h3>
        <p class="cap">${esc(w ? [w.w, w.s, pais(w.c), w.viv ? `Vivino ${String(w.viv).replace(".", ",")}` : ""].filter(Boolean).join(" · ") : "")}</p>
        <div class="btnrow">
          ${sug ? `<button class="btn primary small" data-place="${sug.code}" title="${esc(sug.why)}">Guardar em ${sug.code}</button>` : ""}
          <button class="btn small" data-see>Ver ficha</button>
          <button class="btn quiet small" data-undo>Desfazer</button>
        </div>${sug ? `<p class="note" style="margin:8px 2px 0">${esc(sug.why)}</p>` : ""}</div>`;
    }).join("")}</div>`;
  $$(".result", out).forEach((card) => {
    const it = r.items[+card.dataset.i];
    $("[data-see]", card).onclick = () => openWine(byId(it.id));
    $("[data-undo]", card).onclick = async () => { card.style.opacity = .4; await undoOp(it.undo, it.action === "added" ? "Garrafas removidas" : "Cadastro desfeito"); card.remove(); };
    const pl = $("[data-place]", card);
    if (pl) pl.onclick = async () => { pl.disabled = true; await savePositions([{ id: it.id, add: [pl.dataset.place] }], `${it.name.slice(0, 28)} em ${pl.dataset.place}`); pl.textContent = `Em ${pl.dataset.place}`; };
  });
}

/* ================= AVISOS NO CELULAR ================= */
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function currentSub() { try { return await (await navigator.serviceWorker.ready).pushManager.getSubscription(); } catch { return null; } }
async function openNotify() {
  const sub = pushSupported() ? await currentSub() : null;
  const on = !!sub && Notification.permission === "granted";
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  openSheet(`<p class="eyebrow">Avisos</p><h2>Avisos no celular</h2>
    <p class="sub">Dois avisos, às 20h: no dia seguinte a uma garrafa bebida sem nota ("Como estava?") e aos domingos um resumo da adega com uma sugestão do que abrir.</p>
    ${!pushSupported() || (ios && !standalone()) ? `<div class="card"><p class="comment">${ios ? "No iPhone os avisos só funcionam com o app na Tela de Início: Safari → Compartilhar → Adicionar à Tela de Início, e abra por lá." : "Este navegador não aceita avisos."}</p></div>` : `
    <div class="btnrow">${on ? `<button class="btn" id="nt">Mandar um teste</button><button class="btn danger" id="noff">Desligar</button>` : `<button class="btn primary big" id="non">Ligar avisos</button>`}</div>`}
    <p class="err" id="nerr"></p>`, (root) => {
    $("#non", root)?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      try {
        if ((await Notification.requestPermission()) !== "granted") throw new Error("Permissão negada. Libere nos ajustes do celular.");
        const { key } = await api("push/key");
        const reg = await navigator.serviceWorker.ready;
        const s = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
        await api("push/subscribe", { subscription: s.toJSON() });
        toast("Avisos ligados"); openNotify();
      } catch (err) { $("#nerr", root).textContent = err.message; e.currentTarget.disabled = false; }
    });
    $("#nt", root)?.addEventListener("click", async () => { try { const r = await api("push/test", {}); toast(r.sent ? "Teste enviado" : "Nenhum aparelho inscrito", !r.sent); } catch (err) { toast(err.message, true); } });
    $("#noff", root)?.addEventListener("click", async () => {
      const s = await currentSub();
      if (s) { await api("push/unsubscribe", { endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe(); }
      toast("Avisos desligados"); openNotify();
    });
  });
}
// links dos avisos: ?open=nota:ID (dar nota) ou ?open=abrir
function routeOpen(href) {
  let t = null; try { t = new URL(href).searchParams.get("open"); } catch {}
  if (!t) return false;
  if (t === "abrir") go("abrir");
  else if (t.startsWith("nota:")) { const w = byId(t.slice(5)); if (w) openEdit(w, { focus: "nota" }); }
  return true;
}

/* ================= NÚMEROS ================= */
// os painéis do antigo dashboard ficam em stats.js; aqui só o que eles precisam do app
const H = {
  S, esc, pais, brl, fmtDate, kindColor, openSheet, nBottles, isCellar, wineRow, bindRows, openWine, chip, KIND_LIST, ST_VAR, JAN_LABEL, JAN_ORDER, PT, FLAG,
  rerender: () => renderNum($("#v-num"), H),
  toAdega: (patch) => { Object.assign(S.f, { q: "", kind: null, status: null, zone: null }, patch); go("adega"); },
};

/* ================= início ================= */
function start() {
  $("#login").hidden = true; $("#app").hidden = false;
  go(S.view);
  drawOutbox();
  // vindo de um aviso (?open=…): abre a tela certa depois de ler o Notion, e limpa o endereço (mantém o #k=)
  const opening = new URL(location.href).searchParams.has("open") ? location.href : null;
  if (opening) history.replaceState(null, "", location.pathname + location.hash);
  refresh(true).then(() => { flushOutbox(); if (opening) routeOpen(opening); });
}
navigator.serviceWorker?.addEventListener("message", (e) => { if (e.data?.go) routeOpen(e.data.go); });
(function boot() {
  const linkKey = keyFromLink();
  if (linkKey) store.set(PIN_KEY, linkKey);
  const pin = store.get(PIN_KEY);
  const cache = store.get(CACHE_KEY);
  S.opts = store.get(OPTS_KEY);
  if (!pin) { $("#login").hidden = false; return; }
  if (cache) setData(cache);
  start();
})();
setInterval(syncLabel, 30000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !store.get(PIN_KEY)) return;
  flushOutbox();
  if (!S.readAt || Date.now() - new Date(S.readAt) > 120000) refresh(true);
});
window.addEventListener("resize", () => { if (S.view === "mapa" && ZONES[S.zone].profile) renderMapa(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
// é um app, não uma página: sem zoom de pinça (o iPhone ignora user-scalable=no, então bloqueia o gesto)
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
