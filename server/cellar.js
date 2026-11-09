// Regras do domínio: como um registro do Notion vira um vinho do app e
// como "bebi", "mover" e "cadastrar" viram gravações no Notion.
import * as real from "./notion.js";
import { P, read, DS_CELLAR, DS_TRIPS } from "./notion.js";

// o servidor local troca o Notion por uma cópia em memória quando DEMO=1
let N = real;
export const setBackend = (b) => { N = b; };

const KIND_PT = { Red: "Tinto", White: "Branco", Orange: "Laranja", "Rosé": "Rosé", Fortified: "Fortificado", Sparkling: "Espumante", Brut: "Espumante" };
const KIND_ORDER = ["Red", "White", "Orange", "Rosé", "Fortified", "Sparkling", "Brut"];
const GFIX = { "Carbenet Sauvignon": "Cabernet Sauvignon", Toreldego: "Teroldego", "Pinot Noir (Spätburgunder)": "Pinot Noir", "Gran Syrah": "Syrah" };
export const FLAG = { Argentina: "🇦🇷", Spain: "🇪🇸", Portugal: "🇵🇹", France: "🇫🇷", Brazil: "🇧🇷", Chile: "🇨🇱", Italy: "🇮🇹", "United States": "🇺🇸", Germany: "🇩🇪", China: "🇨🇳",
  "South Africa": "🇿🇦", Austria: "🇦🇹", Uruguay: "🇺🇾", Israel: "🇮🇱", Greece: "🇬🇷", Slovenia: "🇸🇮", Romania: "🇷🇴", Moldova: "🇲🇩", Peru: "🇵🇪", Croatia: "🇭🇷",
  "New Zealand": "🇳🇿", Mexico: "🇲🇽", "Czech Republic": "🇨🇿", Slovakia: "🇸🇰", Australia: "🇦🇺", Hungary: "🇭🇺", Georgia: "🇬🇪", Lebanon: "🇱🇧", Turkey: "🇹🇷",
  Switzerland: "🇨🇭", Albania: "🇦🇱", Montenegro: "🇲🇪", "Bosnia and Herzegovina": "🇧🇦", Serbia: "🇷🇸", "North Macedonia": "🇲🇰", Bulgaria: "🇧🇬", Japan: "🇯🇵", Canada: "🇨🇦" };

const CODE_RE = /^(CLI|AMB)-([A-Z]\d{1,2}|CESTO\d{1,2})$/;
export const parseCodes = (s) => String(s || "").split(/\s*,\s*/).map((x) => x.trim().toUpperCase()).filter(Boolean);
const cleanId = (id) => String(id || "").replace(/-/g, "").replace(/^.*\//, "");

function venue(s) {
  if (!s) return null;
  const low = s.toLowerCase();
  if (low.startsWith("home") || low.includes("casa paula") || (low.includes("paula") && low.includes("place"))) return "Casa";
  return s.split(",")[0].trim();
}

function toWine(page) {
  const p = page.properties;
  const g = (k) => read(p[k]);
  const kinds = g("Kind") || [];
  let viv = g("Vivino"); if (viv != null && viv > 5) viv = Math.round((viv / 10) * 100) / 100;
  let abv = g("Abv"); if (abv != null && abv > 1) abv = abv / 10;
  abv = abv != null ? Math.round(abv * 1000) / 10 : null;
  if (abv != null && (abv < 4 || abv > 25)) abv = null;
  const had = g("Had on");
  const kindKey = KIND_ORDER.find((k) => kinds.includes(k));
  return {
    id: cleanId(page.id),
    url: page.url,
    n: String(g("Name") || "(sem nome)").replace(/\s+/g, " ").trim(),
    w: g("Winery"),
    c: g("Country"),
    reg: g("Region") || [],
    k: kindKey ? KIND_PT[kindKey] : null,
    kinds,
    nat: kinds.includes("Natural"),
    g: [...new Set((g("Grapes") || []).map((x) => GFIX[x] || x))].sort((a, b) => a.localeCompare(b)),
    s: g("Safra"),
    v: g("Value"),
    b: g("Bottles"),
    viv, abv,
    tag: g("Tags") || (had ? "Had" : null),
    had,
    pur: g("Purchase"),
    ct: (page.created_time || "").slice(0, 10),
    ven: venue(g("Where")),
    ppl: g("With") || [],
    pos: parseCodes(g("Position")),
    t: (g("Trip") || [])[0] || null,
    nota: g("nota"),
    com: g("Comment"),
    bought: g("Bought at"),
    link: g("URL"),
    img: (g("Image") || [])[0] || null,
  };
}

function toTrip(page) {
  const p = page.properties;
  const titleKey = Object.keys(p).find((k) => p[k].type === "title");
  const dates = p.Dates && p.Dates.date;
  return {
    id: cleanId(page.id),
    n: read(p[titleKey]) || "(viagem)",
    pa: read(p.Country) || [],
    d0: dates ? dates.start : null,
    d1: dates ? dates.end : null,
  };
}

export async function listAll() {
  const [pages, tripPages] = await Promise.all([
    N.queryAll(DS_CELLAR),
    N.queryAll(DS_TRIPS).catch(() => []),          // sem acesso às viagens, o app segue sem elas
  ]);
  const wines = pages.filter((x) => !x.in_trash && !x.archived).map(toWine);
  const used = new Set(wines.map((w) => w.t).filter(Boolean));
  const trips = tripPages.map(toTrip).filter((t) => used.has(t.id)).sort((a, b) => (a.d0 || "").localeCompare(b.d0 || ""));
  return { wines, trips, readAt: new Date().toISOString() };
}

export async function options() {
  const ds = await N.getDataSource(DS_CELLAR);
  const opts = (k) => {
    const prop = ds.properties && ds.properties[k];
    if (!prop) return [];
    const box = prop[prop.type];
    return (box && box.options ? box.options : []).map((o) => o.name);
  };
  return { country: opts("Country"), grapes: opts("Grapes"), region: opts("Region"), people: opts("With"), kind: opts("Kind"), safra: opts("Safra"), nota: opts("nota") };
}

async function fresh(id) {
  const page = await N.getPage(cleanId(id));
  if (page.in_trash || page.archived) throw Object.assign(new Error("Esse vinho foi apagado no Notion."), { status: 409 });
  return page;
}

/* ---------- posições: aplica remover/adicionar sobre o valor ATUAL do Notion ---------- */
export async function changePositions(changes) {
  // primeiro libera tudo que sai, depois ocupa — assim uma troca entre dois vinhos não colide
  const pages = new Map();
  for (const ch of changes) if (!pages.has(ch.id)) pages.set(ch.id, await fresh(ch.id));
  const state = new Map([...pages].map(([id, pg]) => [id, parseCodes(read(pg.properties.Position))]));
  for (const ch of changes) {
    for (const c of [...(ch.add || []), ...(ch.remove || [])]) if (!CODE_RE.test(c)) throw Object.assign(new Error(`Código de posição inválido: ${c}`), { status: 400 });
    let cur = state.get(ch.id).filter((c) => !(ch.remove || []).includes(c));
    for (const c of ch.add || []) if (!cur.includes(c)) cur.push(c);
    state.set(ch.id, cur);
  }
  for (const [id, codes] of state) {
    const before = parseCodes(read(pages.get(id).properties.Position));
    if (before.join(",") === codes.join(",")) continue;
    await N.updatePage(id, { Position: P.text(codes.join(", ")) });
  }
  return { ok: true };
}

/* ---------- bebi esta garrafa ---------- */
export async function drink({ id, code, date, where, people, nota, comment }) {
  if (!id || !date) throw Object.assign(new Error("Faltou o vinho ou a data."), { status: 400 });
  const page = await fresh(id);
  const p = page.properties;
  const g = (k) => read(p[k]);
  if (g("Tags") === "Had") throw Object.assign(new Error("Esse registro já está marcado como bebido."), { status: 409 });
  const n = Math.max(1, g("Bottles") || 1);
  const codes = parseCodes(g("Position"));
  // tira o vão da garrafa bebida; se não disser qual, tira o último
  const sobra = code && codes.includes(code) ? codes.filter((c) => c !== code) : codes.slice(0, -1);
  const comum = { "Had on": P.date(date) };
  if (where) comum.Where = P.text(where);
  if (people && people.length) comum.With = P.multi(people);
  if (nota) comum.nota = P.select(nota);
  const com = [g("Comment"), comment].filter(Boolean).join(" · ");

  if (n > 1) {
    // várias garrafas: cria um registro "Had" com os dados do vinho e desconta uma da adega
    const props = { Name: P.title(g("Name") || "(sem nome)"), Tags: P.status("Had"), Bottles: P.number(1), ...comum };
    for (const k of ["Winery", "Bought at"]) if (g(k)) props[k] = P.text(g(k));
    for (const k of ["Value", "Vivino", "Abv"]) if (g(k) != null) props[k] = P.number(g(k));
    for (const k of ["Country", "Safra"]) if (g(k)) props[k] = P.select(g(k));
    for (const k of ["Region", "Kind", "Grapes"]) if ((g(k) || []).length) props[k] = P.multi(g(k));
    if ((g("Trip") || []).length) props.Trip = P.relation(g("Trip"));
    if (g("URL")) props.URL = P.url(g("URL"));
    if (g("Purchase")) props.Purchase = P.date(g("Purchase"));
    if (com) props.Comment = P.text(com);
    const novo = await N.createPage(props, FLAG[g("Country")]);
    await N.updatePage(cleanId(id), { Bottles: P.number(n - 1), Position: P.text(sobra.join(", ")) });
    return { ok: true, undo: { type: "split", id: cleanId(id), newId: cleanId(novo.id), bottles: n, codes } };
  }
  const props = { Tags: P.status("Had"), Position: P.text(""), ...comum };
  if (comment) props.Comment = P.text(com);
  await N.updatePage(cleanId(id), props);
  return { ok: true, undo: { type: "single", id: cleanId(id), codes, before: { where: g("Where"), with: g("With") || [], nota: g("nota"), comment: g("Comment"), had: g("Had on") } } };
}

/* ---------- desfazer: "bebi", cadastro ---------- */
export async function undo(u) {
  if (!u || !u.type || !u.id) throw Object.assign(new Error("Nada para desfazer."), { status: 400 });
  if (u.type === "split") {
    if (u.newId) await N.archivePage(cleanId(u.newId));
    await N.updatePage(cleanId(u.id), { Bottles: P.number(u.bottles), Position: P.text((u.codes || []).join(", ")) });
  } else if (u.type === "single") {
    const b = u.before || {};
    await N.updatePage(cleanId(u.id), {
      Tags: P.status("Cellar"), Position: P.text((u.codes || []).join(", ")), "Had on": P.date(b.had || null),
      Where: P.text(b.where || ""), With: P.multi(b.with || []), nota: P.select(b.nota || null), Comment: P.text(b.comment || ""),
    });
  } else if (u.type === "bottles") {
    await N.updatePage(cleanId(u.id), { Bottles: P.number(u.bottles) });
  } else if (u.type === "created") {
    for (const id of [].concat(u.id)) await N.archivePage(cleanId(id));
  } else throw Object.assign(new Error("Tipo de desfazer desconhecido."), { status: 400 });
  return { ok: true };
}

/* ---------- completar dados: grava só os campos enviados ---------- */
const EDITABLE = {
  name: (v) => ["Name", P.title(v)], winery: (v) => ["Winery", P.text(v)], country: (v) => ["Country", P.select(v)],
  safra: (v) => ["Safra", P.select(v ? String(v) : null)], value: (v) => ["Value", P.number(v)], vivino: (v) => ["Vivino", P.number(v)],
  abv: (v) => ["Abv", P.number(v === "" || v == null ? null : +v > 1 ? +v / 100 : +v)], bottles: (v) => ["Bottles", P.number(v)],
  grapes: (v) => ["Grapes", P.multi(v)], region: (v) => ["Region", P.multi(v)], kinds: (v) => ["Kind", P.multi(v)],
  nota: (v) => ["nota", P.select(v || null)], comment: (v) => ["Comment", P.text(v)], link: (v) => ["URL", P.url(v)],
  boughtAt: (v) => ["Bought at", P.text(v)], purchase: (v) => ["Purchase", P.date(v || null)],
};
export async function update({ id, fields }) {
  if (!id || !fields) throw Object.assign(new Error("Faltou o vinho ou os campos."), { status: 400 });
  await fresh(id);
  const props = {};
  for (const [k, v] of Object.entries(fields)) if (EDITABLE[k]) { const [name, val] = EDITABLE[k](v); props[name] = val; }
  if (!Object.keys(props).length) throw Object.assign(new Error("Nenhum campo para gravar."), { status: 400 });
  await N.updatePage(cleanId(id), props);
  return { ok: true };
}

export { N as backend, toWine, cleanId, CODE_RE };

/* ---------- cadastrar garrafa ---------- */
export async function create(f) {
  if (!f.name || !f.name.trim()) throw Object.assign(new Error("Dê um nome ao vinho."), { status: 400 });
  const props = { Name: P.title(f.name.trim()), Tags: P.status("Cellar"), Bottles: P.number(Math.max(1, +f.bottles || 1)) };
  if (f.winery) props.Winery = P.text(f.winery);
  if (f.country) props.Country = P.select(f.country);
  if (f.safra) props.Safra = P.select(String(f.safra));
  if (f.value !== "" && f.value != null) props.Value = P.number(f.value);
  if (f.vivino !== "" && f.vivino != null) props.Vivino = P.number(f.vivino);
  if (f.abv !== "" && f.abv != null) props.Abv = P.number(+f.abv > 1 ? +f.abv / 100 : f.abv);
  if (f.kinds && f.kinds.length) props.Kind = P.multi(f.kinds);
  if (f.grapes && f.grapes.length) props.Grapes = P.multi(f.grapes);
  if (f.region && f.region.length) props.Region = P.multi(f.region);
  if (f.boughtAt) props["Bought at"] = P.text(f.boughtAt);
  if (f.purchase) props.Purchase = P.date(f.purchase);
  if (f.trip) props.Trip = P.relation([f.trip]);
  if (f.comment) props.Comment = P.text(f.comment);
  const codes = (f.codes || []).filter((c) => CODE_RE.test(c));
  if (codes.length) props.Position = P.text(codes.join(", "));
  if (f.link) props.URL = P.url(f.link);
  if (f.images && f.images.length) props.Image = P.files(f.images);
  const page = await N.createPage(props, FLAG[f.country]);
  return { ok: true, id: cleanId(page.id), undo: { type: "created", id: cleanId(page.id) } };
}
