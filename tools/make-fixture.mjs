// Gera fixtures/pages.json a partir dos dados embutidos no painel antigo (artifact),
// no formato de página da API do Notion. Só serve para testar o app com DEMO=1.
// uso: node tools/make-fixture.mjs caminho/do/artifact.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const html = readFileSync(process.argv[2], "utf8");
const grab = (name) => {
  const m = html.match(new RegExp(`let ${name} = (\\[.*?\\]|\\{.*?\\});\\s*$`, "m"));
  return JSON.parse(m[1]);
};
const DATA = grab("DATA"), TRIPS = grab("TRIPS");
const EN = { Tinto: "Red", Branco: "White", Laranja: "Orange", "Rosé": "Rosé", Fortificado: "Fortified", Espumante: "Sparkling" };
const rt = (s) => (s ? [{ plain_text: String(s) }] : []);
const uuid = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
const sel = (s) => ({ type: "select", select: s ? { name: s } : null });
const ms = (a) => ({ type: "multi_select", multi_select: (a || []).map((name) => ({ name })) });
const num = (n) => ({ type: "number", number: n ?? null });
const date = (d) => ({ type: "date", date: d ? { start: d } : null });

const cellar = DATA.map((r) => {
  const id = r.url.split("/").pop();
  const kinds = [r.k && EN[r.k], r.nat && "Natural"].filter(Boolean);
  return {
    id: uuid(id), url: r.url, created_time: (r.ct || "2024-01-01") + "T12:00:00.000Z",
    properties: {
      Name: { type: "title", title: rt(r.n) },
      Winery: { type: "rich_text", rich_text: rt(r.w) },
      Country: sel(r.c), Region: ms(r.reg), Kind: ms(kinds), Grapes: ms(r.g), Safra: sel(r.s),
      Value: num(r.v), Bottles: num(r.b), Vivino: num(r.viv), Abv: num(r.abv != null ? r.abv / 100 : null),
      Tags: { type: "status", status: r.tag ? { name: r.tag } : null },
      "Had on": date(r.had), Purchase: date(r.pur),
      Where: { type: "rich_text", rich_text: rt(r.ven) }, With: ms(r.ppl),
      Position: { type: "rich_text", rich_text: rt(r.pos) },
      Trip: { type: "relation", relation: r.t ? [{ id: uuid(r.t) }] : [] },
      Comment: { type: "rich_text", rich_text: [] }, nota: sel(null),
    },
  };
});
const trips = TRIPS.map((t) => ({
  id: uuid(t.id), url: t.url, created_time: "2024-01-01T00:00:00.000Z",
  properties: {
    Where: { type: "title", title: rt(t.n) },
    Country: { type: "multi_select", multi_select: (t.pa || []).map((name) => ({ name })) },
    Dates: { type: "date", date: t.d0 ? { start: t.d0, end: t.d1 } : null },
  },
}));
const uniq = (f) => [...new Set(DATA.flatMap(f).filter(Boolean))].sort().map((name) => ({ name }));
const schema = {
  Country: { type: "select", select: { options: uniq((r) => [r.c]) } },
  Grapes: { type: "multi_select", multi_select: { options: uniq((r) => r.g) } },
  Region: { type: "multi_select", multi_select: { options: uniq((r) => r.reg) } },
  With: { type: "multi_select", multi_select: { options: uniq((r) => r.ppl) } },
  Kind: { type: "multi_select", multi_select: { options: ["Red", "Orange", "White", "Natural", "Brut", "Rosé", "Fortified", "Sparkling"].map((name) => ({ name })) } },
  Safra: { type: "select", select: { options: uniq((r) => [r.s]) } },
  nota: { type: "select", select: { options: ["⭐️ ⭐️ ⭐️ ⭐️ ⭐️", "⭐️ ⭐️ ⭐️ ⭐️½", "⭐️ ⭐️ ⭐️ ⭐️", "⭐️ ⭐️ ⭐️½", "⭐️ ⭐️ ⭐️", "⭐️ ⭐️", "⭐️", "TBD"].map((name) => ({ name })) } },
};
mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
writeFileSync(new URL("../fixtures/pages.json", import.meta.url), JSON.stringify({ cellar, trips, schema }));
console.log(`fixture: ${cellar.length} vinhos, ${trips.length} viagens`);
