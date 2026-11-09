// Aba "Números": os painéis do antigo dashboard (visão geral, adega, viagens, tempo de adega,
// preço & nota, origens), refeitos para a tela do celular. Tudo é calculado no aparelho a partir
// da última leitura do Notion.

const TABS = [["consumo", "Consumo"], ["adega", "Adega"], ["viagens", "Viagens"], ["tempo", "Tempo"], ["preco", "Preço & nota"], ["origens", "Origens"]];
const PERIODS = [["12m", "12 meses"], ["ano", "Este ano"], ["tudo", "Tudo"]];
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY = 864e5;
const st = { tab: "consumo", period: "12m" };

/* ---------- utilidades ---------- */
const qtd = (r) => (r.tag === "Cellar" ? Math.max(1, r.b || 1) : 1);
const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const one = (v) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const int = (v) => Math.round(v).toLocaleString("pt-BR");
const dias = (a, b) => (new Date(b) - new Date(a)) / DAY;
const entrada = (r) => r.pur || (r.ct ? r.ct.slice(0, 10) : null);
const safraData = (r) => (/^\d{4}$/.test(r.s || "") ? `${r.s}-04-01` : null);
const today = () => new Date().toISOString().slice(0, 10);
function dur(d) {
  if (d == null) return "—";
  if (d < 45) return `${int(d)} dias`;
  if (d < 700) return `${one(d / 30.44)} meses`;
  return `${one(d / 365.25)} anos`;
}
function countBy(rows, f, w = () => 1) {
  const m = new Map();
  for (const r of rows) for (const k of [].concat(f(r) || [])) if (k) m.set(k, (m.get(k) || 0) + w(r));
  return [...m].sort((a, b) => b[1] - a[1]);
}

/* ---------- blocos visuais ---------- */
const stat = (v, k, n = "", attrs = "") => `<div class="stat card${attrs ? " tap" : ""}" ${attrs}><div class="v">${v}</div><div class="k">${k}</div>${n ? `<div class="n">${n}</div>` : ""}</div>`;
const card = (title, cap, body) => `<div class="card"><h3>${title}</h3>${cap ? `<p class="cap">${cap}</p>` : `<div style="height:12px"></div>`}${body}</div>`;
// barras horizontais; parts = [{v, color}] empilha
function bars(items, { color = "var(--accent)", fmt = int, unit = "" } = {}, esc) {
  if (!items.length) return `<p class="note">Nada neste recorte.</p>`;
  const max = Math.max(...items.map((i) => i.v), 1e-9);
  return `<div class="bars">${items.map((i) => {
    const parts = i.parts || [{ v: i.v, color: i.color || color }];
    const tag = i.act ? "button" : "div";
    return `<${tag} class="barrow" ${i.act || ""}><span class="lbl">${esc(i.l)}</span><span class="track">${parts.map((p) => `<span class="fill" style="width:${(p.v / max) * 100}%;background:${p.color}"></span>`).join("")}</span><b>${fmt(i.v)}${i.x ? `<small>${esc(i.x)}</small>` : unit ? `<small>${unit}</small>` : ""}</b></${tag}>`;
  }).join("")}</div>`;
}
// colunas; parts empilha
function cols(cats, { color = "var(--accent)", showVals = true } = {}) {
  const max = Math.max(1, ...cats.map((c) => c.v));
  return `<div class="cols" style="grid-template-columns:repeat(${cats.length},minmax(0,1fr))">${cats.map((c) => `<div>${showVals ? `<b>${c.v ? int(c.v) : ""}</b>` : ""}<i style="height:calc(${(c.v / max).toFixed(3)} * (100% - 36px));${c.parts ? "background:none" : `background:${c.color || color}`}">${(c.parts || []).map((p) => `<u style="height:${c.v ? (p.v / c.v) * 100 : 0}%;background:${p.color}"></u>`).join("")}</i><span>${c.l}</span></div>`).join("")}</div>`;
}
function ranks(items, esc) {
  return `<div class="ranks">${items.map((r, i) => `<button class="rank" data-id="${r.id || ""}"><span class="n">${i + 1}</span><span style="min-width:0"><span class="t" style="display:block">${esc(r.t)}</span><span class="m" style="display:block">${esc(r.m || "")}</span></span><span class="v">${r.v}${r.vs ? `<small>${esc(r.vs)}</small>` : ""}</span></button>`).join("")}</div>`;
}
const legend = (items) => `<div class="legend" style="margin:0 0 10px">${items.map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>`;

/* ---------- abas ---------- */
function consumo(H) {
  const { S, esc, pais, brl } = H;
  const now = new Date(), y = now.getFullYear();
  const allHad = S.wines.filter((w) => w.tag === "Had" && w.had);
  const since = st.period === "12m" ? new Date(now - 365 * DAY).toISOString().slice(0, 10) : st.period === "ano" ? `${y}-01-01` : "0000";
  const had = allHad.filter((w) => w.had >= since);
  const weeks = st.period === "tudo" ? Math.max(1, dias(allHad.map((w) => w.had).sort()[0] || today(), today()) / 7) : st.period === "ano" ? Math.max(1, dias(`${y}-01-01`, today()) / 7) : 52;
  const precos = had.filter((w) => w.v != null).map((w) => w.v);
  const notas = had.filter((w) => w.viv != null).map((w) => w.viv);
  const months = [...Array(12)].map((_, i) => { const d = new Date(y, now.getMonth() - 11 + i, 1); return { k: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, l: MES[d.getMonth()] }; });
  const years = [...new Set(allHad.map((w) => w.had.slice(0, 4)))].sort();
  const kindRows = countBy(had, (w) => w.k || "Sem tipo");
  const wd = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ l: WEEK[i], v: had.filter((w) => new Date(w.had + "T12:00").getDay() === i).length }));
  const kinds = H.KIND_LIST.filter((k) => allHad.some((w) => w.k === k));
  return `
    <div class="chips">${PERIODS.map(([k, l]) => H.chip(l, st.period === k, `data-period="${k}"`)).join("")}</div>
    <div class="stats">
      ${stat(int(had.length), "garrafas abertas", `${one(had.length / weeks)} por semana`)}
      ${stat(precos.length ? brl(median(precos)) : "—", "preço mediano", precos.length ? `${int(precos.length)} com preço` : "")}
      ${stat(notas.length ? one(mean(notas)) : "—", "nota Vivino média", notas.length ? `${int(notas.length)} avaliadas` : "")}
      ${stat(int(new Set(had.map((w) => w.c).filter(Boolean)).size), "países", `${int(new Set(had.flatMap((w) => w.g || [])).size)} castas`)}
    </div>
    ${card("Mês a mês", "Garrafas abertas nos últimos 12 meses.", cols(months.map((m) => ({ l: m.l, v: allHad.filter((w) => w.had.startsWith(m.k)).length }))))}
    ${card("Ano a ano", "Tipos de vinho abertos em cada ano.", legend(kinds.map((k) => [k, H.kindColor(k)])) + cols(years.map((yy) => {
      const rs = allHad.filter((w) => w.had.startsWith(yy));
      return { l: yy.slice(2) === String(y).slice(2) ? `${yy.slice(2)}*` : yy.slice(2), v: rs.length, parts: kinds.map((k) => ({ v: rs.filter((w) => w.k === k).length, color: H.kindColor(k) })) };
    })) + `<p class="note" style="margin:8px 0 0">* ano em andamento</p>`)}
    ${card("Tipos", "", bars(kindRows.map(([l, v]) => ({ l, v, color: H.kindColor(l), x: `${Math.round((v / Math.max(1, had.length)) * 100)}%` })), {}, esc))}
    ${card("Com quem", "", bars(countBy(had, (w) => w.ppl).slice(0, 8).map(([l, v]) => ({ l, v })), { color: "var(--s5)" }, esc))}
    ${card("Onde", "", bars(countBy(had, (w) => w.ven).slice(0, 6).map(([l, v]) => ({ l, v })), { color: "var(--s4)" }, esc))}
    ${card("Dia da semana", "", cols(wd, { color: "var(--s2)" }))}
    ${card("Países", "", bars(countBy(had, (w) => w.c).slice(0, 8).map(([l, v]) => ({ l: pais(l), v })), { color: "var(--s3)" }, esc))}
    <div class="sect"><h2>Últimos abertos</h2><span>${int(allHad.length)} no total</span></div>
    <div class="list">${allHad.sort((a, b) => b.had.localeCompare(a.had)).slice(0, 15).map((w) => H.wineRow(w, { had: true })).join("")}</div>`;
}

function adega(H) {
  const { S, esc, pais, brl } = H;
  const cel = S.wines.filter(H.isCellar);
  const garr = sum(cel, qtd);
  const priced = cel.filter((w) => w.v != null);
  const valor = sum(priced, (w) => w.v * qtd(w));
  const safras = cel.filter((w) => /^\d{4}$/.test(w.s || "")).map((w) => +w.s);
  const semPos = sum(cel, (w) => Math.max(0, qtd(w) - w.pos.length));
  const bySafra = countBy(cel, (w) => w.s, qtd).filter(([s]) => /^\d{4}$/.test(s)).sort((a, b) => a[0].localeCompare(b[0]));
  const caras = [...priced].sort((a, b) => b.v - a.v).slice(0, 8);
  return `
    <div class="stats">
      ${stat(int(garr), "garrafas", `${int(cel.length)} rótulos`)}
      ${stat(valor ? brl(valor) : "—", "valor guardado", `${int(priced.length)} de ${int(cel.length)} rótulos com preço`)}
      ${stat(priced.length ? brl(mean(priced.map((w) => w.v))) : "—", "preço médio", priced.length ? `mediana ${brl(median(priced.map((w) => w.v)))}` : "")}
      ${stat(safras.length ? Math.min(...safras) : "—", "safra mais antiga", semPos ? `${int(semPos)} garrafas sem posição` : "todas com posição")}
    </div>
    ${card("Por status da janela", "Toque para ver só esses.", bars(H.JAN_ORDER.map((s) => ({ l: H.JAN_LABEL[s], v: sum(cel.filter((w) => w.j?.status === s), qtd), color: `var(${H.ST_VAR[s]})`, act: `data-status="${s}"` })).filter((i) => i.v), { unit: "garr." }, esc))}
    ${card("Por país", "Toque num país para filtrar a adega.", bars(countBy(cel, (w) => w.c, qtd).map(([l, v]) => ({ l: pais(l), v, act: `data-q="${esc(H.PT[l] || l)}"` })), { color: "var(--s1)" }, esc))}
    ${card("Por tipo", "", bars(countBy(cel, (w) => w.k || "Sem tipo", qtd).map(([l, v]) => ({ l, v, color: H.kindColor(l), act: H.KIND_LIST.includes(l) ? `data-kind="${l}"` : "" })), {}, esc))}
    ${card("Por safra", "", cols(bySafra.map(([l, v]) => ({ l: `'${l.slice(2)}`, v })), { color: "var(--s3)" }))}
    ${card("As mais caras", "Preço pago por garrafa.", ranks(caras.map((w) => ({ id: w.id, t: w.n, m: [w.s, pais(w.c)].filter(Boolean).join(" · "), v: brl(w.v), vs: w.viv ? `★ ${one(w.viv)}` : "" })), esc))}`;
}

function viagens(H) {
  const { S, esc, brl } = H;
  const rowsOf = (t) => S.wines.filter((w) => w.t === t.id);
  const T = S.trips.filter((t) => rowsOf(t).length).sort((a, b) => (b.d0 || "").localeCompare(a.d0 || ""));
  const all = S.wines.filter((w) => w.t);
  const nCel = sum(all.filter(H.isCellar), qtd), nHad = sum(all.filter((w) => !H.isCellar(w)), qtd);
  const gasto = (rs) => sum(rs.filter((w) => w.v != null), (w) => w.v * qtd(w));
  const lbl = (t) => `${t.n}${t.d0 ? ` · ${t.d0.slice(2, 4) === today().slice(2, 4) ? MES[+t.d0.slice(5, 7) - 1] : t.d0.slice(0, 4)}` : ""}`;
  return `
    <div class="stats">
      ${stat(int(T.length), "viagens com vinho")}
      ${stat(int(nCel + nHad), "garrafas trazidas", `${int(new Set(all.map((w) => w.c).filter(Boolean)).size)} países`)}
      ${stat(int(nCel), "ainda na adega", `${Math.round((nCel / Math.max(1, nCel + nHad)) * 100)}% do que veio`)}
      ${stat(brl(gasto(all)), "gasto nas viagens", `${int(nHad)} já abertas`)}
    </div>
    ${card("Garrafas por viagem", "Toque numa viagem para ver os vinhos.", legend([["Na adega", "var(--s1)"], ["Já abertas", "var(--fill2)"]]) + bars(T.map((t) => {
      const rs = rowsOf(t), c = sum(rs.filter(H.isCellar), qtd), h = sum(rs.filter((w) => !H.isCellar(w)), qtd);
      return { l: lbl(t), v: c + h, parts: [{ v: c, color: "var(--s1)" }, { v: h, color: "var(--fill2)" }], act: `data-trip="${t.id}"` };
    }), {}, esc))}`;
}

function tempo(H) {
  const { S, esc, fmtDate } = H;
  const had = S.wines.filter((w) => w.tag === "Had" && w.had);
  const cel = S.wines.filter(H.isCellar);
  const abertos = had.filter((r) => entrada(r)).map((r) => { const ent = entrada(r), sd = safraData(r); return { r, guarda: dias(ent, r.had), ic: sd ? dias(sd, ent) : null }; });
  const guardados = abertos.filter((x) => x.guarda > 7);
  const idadeAbrir = had.filter(safraData).map((r) => dias(safraData(r), r.had));
  const hoje = cel.filter(entrada).map((r) => ({ r, espera: dias(entrada(r), today()), idade: safraData(r) ? dias(safraData(r), today()) : null })).sort((a, b) => b.espera - a.espera);
  const BINS = [["≤1 m", 0, 30], ["1–3 m", 30, 91], ["3–6 m", 91, 182], ["6–12 m", 182, 365], ["1–2 a", 365, 730], ["2 a+", 730, 1e9]];
  return `
    <div class="stats">
      ${stat(dur(median(guardados.map((x) => x.guarda))), "guardada antes de abrir", `mediana · ${int(guardados.length)} garrafas`)}
      ${stat(dur(median(idadeAbrir)), "idade ao abrir", "mediana, da safra à taça")}
      ${stat(dur(median(guardados.map((x) => x.ic).filter((v) => v != null))), "idade ao comprar", "mediana, da safra à entrada")}
      ${stat(dur(median(hoje.map((x) => x.espera))), "hoje na adega há", `mediana · ${int(hoje.length)} rótulos`)}
    </div>
    ${card("Quanto tempo ficaram guardadas", `${int(abertos.length - guardados.length)} foram abertas na mesma semana em que chegaram (fora do gráfico).`, cols(BINS.map(([l, a, b]) => ({ l, v: guardados.filter((x) => x.guarda >= a && x.guarda < b).length })), { color: "var(--s2)" }))}
    ${card("Esperando há mais tempo", "Na adega hoje, desde a compra ou o cadastro.", ranks(hoje.slice(0, 10).map((x) => ({ id: x.r.id, t: x.r.n, m: `entrou em ${fmtDate(entrada(x.r))}${x.idade != null ? ` · safra ${x.r.s}` : ""}`, v: dur(x.espera), vs: x.r.j ? H.JAN_LABEL[x.r.j.status] : "" })), esc))}`;
}

function preco(H) {
  const { S, esc, pais, brl } = H;
  const F = S.wines;
  const priced = F.filter((w) => w.v != null), viv = F.filter((w) => w.viv != null).map((w) => w.viv);
  const both = F.filter((w) => w.v != null && w.viv != null && w.v > 0);
  const top = priced.length ? priced.reduce((a, b) => (a.v > b.v ? a : b)) : null;
  const BANDS = [[0, 80, "até 80"], [80, 150, "80–150"], [150, 250, "150–250"], [250, 400, "250–400"], [400, 1e9, "400+"]];
  const NB = [[0, 3.7, "<3,7"], [3.7, 3.9, "3,7"], [3.9, 4.1, "3,9"], [4.1, 4.3, "4,1"], [4.3, 4.5, "4,3"], [4.5, 6, "4,5+"]];
  const cb = both.filter((w) => w.v >= 20).map((w) => ({ w, r: (w.viv / w.v) * 100 })).sort((a, b) => b.r - a.r).slice(0, 8);
  return `
    <div class="stats">
      ${stat(priced.length ? brl(median(priced.map((w) => w.v))) : "—", "preço mediano", `${int(priced.length)} de ${int(F.length)} com preço`)}
      ${stat(top ? brl(top.v) : "—", "a mais cara", top ? top.n : "", top ? `data-id="${top.id}"` : "")}
      ${stat(viv.length ? one(mean(viv)) : "—", "nota Vivino média", viv.length ? `mediana ${one(median(viv))}` : "")}
      ${stat(viv.length ? int(viv.filter((v) => v >= 4.3).length) : "—", "nota 4,3 ou mais", viv.length ? `${Math.round((viv.filter((v) => v >= 4.3).length / viv.length) * 100)}% das avaliadas` : "")}
    </div>
    ${card("Preço pago × nota Vivino", "Cada ponto é um rótulo. Acima e à esquerda estão as melhores compras. Toque num ponto.", legend([["Tinto", "var(--k-tinto)"], ["Branco", "var(--k-branco)"], ["Outros", "var(--muted)"]]) + scatter(both))}
    ${card("Faixas de preço", "Rótulos em cada faixa, em reais.", cols(BANDS.map(([a, b, l]) => ({ l, v: priced.filter((w) => w.v >= a && w.v < b).length })), { color: "var(--s1)" }))}
    ${card("Notas Vivino", "", cols(NB.map(([a, b, l]) => ({ l, v: viv.filter((v) => v >= a && v < b).length })), { color: "var(--s3)" }))}
    ${card("Melhor custo-benefício", "Pontos de nota por R$ 100 pagos, acima de R$ 20.", ranks(cb.map(({ w, r }) => ({ id: w.id, t: w.n, m: `${brl(w.v)} · ★ ${one(w.viv)} · ${pais(w.c)}`, v: one(r) })), esc))}`;
}

function scatter(rows) {
  if (!rows.length) return `<p class="note">Sem rótulos com preço e nota.</p>`;
  const W = 340, Hh = 230, L = 30, B = 22, T = 8, R = 8;
  const xs = rows.map((w) => w.v), maxX = Math.min(Math.max(...xs), median(xs) * 4 || 1);
  const minY = Math.min(3.4, ...rows.map((w) => w.viv)), maxY = Math.max(4.7, ...rows.map((w) => w.viv));
  const sx = (v) => L + (Math.min(v, maxX) / maxX) * (W - L - R), sy = (v) => T + (1 - (v - minY) / (maxY - minY)) * (Hh - T - B);
  const step = maxX > 600 ? 200 : maxX > 300 ? 100 : 50;
  const col = (k) => (k === "Tinto" ? "var(--k-tinto)" : k === "Branco" ? "var(--k-branco)" : "var(--muted)");
  let g = "";
  for (let v = 0; v <= maxX; v += step) g += `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${Hh - B}"/><text x="${sx(v)}" y="${Hh - 6}" text-anchor="middle">${v}</text>`;
  for (let v = Math.ceil(minY * 2) / 2; v <= maxY; v += 0.5) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 5}" y="${sy(v) + 3}" text-anchor="end">${String(v).replace(".", ",")}</text>`;
  const dots = rows.map((w) => `<circle data-id="${w.id}" cx="${sx(w.v).toFixed(1)}" cy="${sy(w.viv).toFixed(1)}" r="5" fill="${col(w.k)}" fill-opacity=".8"><title>${w.n.replace(/</g, "")}</title></circle>`).join("");
  return `<svg class="scatter" viewBox="0 0 ${W} ${Hh}">${g}<text x="${W - R}" y="${Hh - B - 4}" text-anchor="end">R$ pago</text><text x="${L + 4}" y="${T + 10}">nota</text>${dots}</svg>${xs.some((v) => v > maxX) ? `<p class="note" style="margin:6px 0 0">Preços acima de R$ ${int(maxX)} aparecem na borda direita.</p>` : ""}`;
}

function origens(H) {
  const { S, esc, pais } = H;
  const F = S.wines;
  const pares = countBy(F.filter((w) => w.c && w.g?.length), (w) => w.g.map((g) => `${g}|${w.c}`)).slice(0, 10);
  const castasPaises = countBy([...new Set(F.flatMap((w) => (w.c ? (w.g || []).map((g) => `${g}|${w.c}`) : [])))], (k) => k.split("|")[0]).filter(([, n]) => n > 1).slice(0, 8);
  return `
    <div class="stats">
      ${stat(int(new Set(F.map((w) => w.c).filter(Boolean)).size), "países")}
      ${stat(int(new Set(F.flatMap((w) => w.g || [])).size), "castas")}
      ${stat(int(new Set(F.flatMap((w) => w.reg || [])).size), "regiões")}
      ${stat(int(new Set(F.map((w) => w.w).filter(Boolean)).size), "produtores")}
    </div>
    ${card("Países", "Todos os rótulos, abertos e guardados.", bars(countBy(F, (w) => w.c).slice(0, 14).map(([l, v]) => ({ l: pais(l), v })), { color: "var(--s1)" }, esc))}
    ${card("Castas mais presentes", "", bars(countBy(F, (w) => w.g).slice(0, 12).map(([l, v]) => ({ l, v })), { color: "var(--s3)" }, esc))}
    ${card("Regiões", "", bars(countBy(F, (w) => w.reg).slice(0, 10).map(([l, v]) => ({ l, v })), { color: "var(--s2)" }, esc))}
    ${card("Produtores recorrentes", "", bars(countBy(F, (w) => w.w).filter(([, v]) => v > 1).slice(0, 10).map(([l, v]) => ({ l, v })), { color: "var(--s6)" }, esc))}
    ${card("País × casta", "As combinações que mais aparecem.", bars(pares.map(([k, v]) => { const [g, c] = k.split("|"); return { l: `${g} · ${H.FLAG[c] || c}`, v }; }), { color: "var(--s5)" }, esc))}
    ${card("Castas que viajam", "Em quantos países diferentes cada casta aparece.", bars(castasPaises.map(([l, v]) => ({ l, v })), { color: "var(--s4)", unit: "países" }, esc))}`;
}

/* ---------- montagem ---------- */
export function renderNum(root, H) {
  if (!H.S.wines.length) { root.innerHTML = `<p class="empty">Carregando…</p>`; return; }
  const body = { consumo, adega, viagens, tempo, preco, origens }[st.tab](H);
  root.innerHTML = `<div class="chips" id="numtabs" style="padding-top:4px">${TABS.map(([k, l]) => H.chip(l, st.tab === k, `data-tab="${k}"`)).join("")}</div><div class="stack">${body}</div>`;
  root.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { st.tab = b.dataset.tab; H.rerender(); window.scrollTo(0, 0); });
  root.querySelectorAll("[data-period]").forEach((b) => b.onclick = () => { st.period = b.dataset.period; H.rerender(); });
  root.querySelectorAll("[data-id]").forEach((b) => { if (b.dataset.id) b.addEventListener("click", () => H.openWine(H.S.wines.find((w) => w.id === b.dataset.id))); });
  root.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => H.toAdega({ q: b.dataset.q }));
  root.querySelectorAll("[data-kind]").forEach((b) => b.onclick = () => H.toAdega({ kind: b.dataset.kind }));
  root.querySelectorAll("[data-status]").forEach((b) => b.onclick = () => H.toAdega({ status: b.dataset.status }));
  root.querySelectorAll("[data-trip]").forEach((b) => b.onclick = () => {
    const t = H.S.tripBy.get(b.dataset.trip), rs = H.S.wines.filter((w) => w.t === t.id);
    const cel = rs.filter(H.isCellar), had = rs.filter((w) => !H.isCellar(w));
    H.openSheet(`<p class="eyebrow">Viagem</p><h2>${H.esc(t.n)}</h2><p class="sub">${[t.d0 && H.fmtDate(t.d0), `${rs.length} rótulos`].filter(Boolean).join(" · ")}</p>
      ${cel.length ? `<div class="sect sm"><h2>Na adega</h2><span>${cel.length}</span></div><div class="list">${cel.map((w) => H.wineRow(w)).join("")}</div>` : ""}
      ${had.length ? `<div class="sect sm"><h2>Já abertas</h2><span>${had.length}</span></div><div class="list">${had.map((w) => H.wineRow(w, { had: true })).join("")}</div>` : ""}`, (r) => H.bindRows(r));
  });
  H.bindRows(root);
}
