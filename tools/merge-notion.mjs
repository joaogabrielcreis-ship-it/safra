// Atualiza fixtures/pages.json com linhas exportadas do Notion (fixtures/notion-*.json).
// uso: node tools/merge-notion.mjs fixtures/notion-AAAA-MM-DD.json
import { readFileSync, writeFileSync } from "node:fs";
const fx = JSON.parse(readFileSync("fixtures/pages.json", "utf8"));
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rt = (s) => (s ? [{ plain_text: String(s) }] : []);
const uuid = (h) => h.includes("-") ? h : `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
const sel = (s) => ({ type: "select", select: s ? { name: s } : null });
const ms = (a) => ({ type: "multi_select", multi_select: (a || []).map((name) => ({ name })) });
const num = (n) => ({ type: "number", number: n ?? null });
const date = (d) => ({ type: "date", date: d ? { start: d } : null });
const byId = new Map(fx.cellar.map((p) => [p.id, p]));
const fresh = new Set();
for (const [id, ct, n, w, c, reg, kinds, g, s, v, b, viv, abv, tag, had, pur, ven, ppl, pos, trip, bought, link] of rows) {
  fresh.add(id);
  const old = byId.get(id);
  const page = {
    id, url: `https://app.notion.com/${id.replace(/-/g, "")}`, created_time: ct + "T12:00:00.000Z",
    properties: {
      ...(old?.properties || {}),
      Name: { type: "title", title: rt(n) }, Winery: { type: "rich_text", rich_text: rt(w) },
      Country: sel(c), Region: ms(reg), Kind: ms(kinds), Grapes: ms(g), Safra: sel(s),
      Value: num(v), Bottles: num(b), Vivino: num(viv), Abv: num(abv),
      Tags: { type: "status", status: { name: tag } }, "Had on": date(had), Purchase: date(pur),
      Where: { type: "rich_text", rich_text: rt(ven) }, With: ms(ppl),
      Position: { type: "rich_text", rich_text: rt(tag === "Cellar" ? pos : null) },
      Trip: { type: "relation", relation: trip ? [{ id: uuid(trip) }] : [] },
      "Bought at": { type: "rich_text", rich_text: rt(bought) }, URL: { type: "url", url: link },
    },
  };
  if (old) Object.assign(old, page); else fx.cellar.push(page);
}
// o que estava na adega na cópia antiga e não está mais: saiu (bebido antes da janela exportada)
let gone = 0;
for (const p of fx.cellar) if (p.properties.Tags.status?.name === "Cellar" && !fresh.has(p.id)) { p.properties.Tags.status = { name: "Had" }; p.properties.Position.rich_text = []; gone++; }
const tripIds = new Set(fx.trips.map((t) => t.id));
const missing = [...new Set(rows.map((r) => r[19]).filter(Boolean).map(uuid))].filter((t) => !tripIds.has(t));
writeFileSync("fixtures/pages.json", JSON.stringify(fx));
const cel = fx.cellar.filter((p) => p.properties.Tags.status?.name === "Cellar");
console.log(`total ${fx.cellar.length}, adega ${cel.length} rótulos / ${cel.reduce((s, p) => s + Math.max(1, p.properties.Bottles.number || 1), 0)} garrafas, saíram ${gone}, viagens faltando: ${missing.join(", ") || "nenhuma"}`);
