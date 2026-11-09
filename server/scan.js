// Cadastro automático por foto: as fotos vão para o Claude (visão + busca na web para o Vivino),
// que devolve os vinhos identificados; cada um vira um registro no Notion (ou soma garrafas
// num que já está na adega), com a foto anexada no campo Image.
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.js";
import { P, read } from "./notion.js";
import { backend, listAll, options, create, cleanId } from "./cellar.js";
import { SCAN_PROMPT, SCAN_SCHEMA } from "./scan-prompt.js";

const MODEL = "claude-opus-5-5";
const err = (status, msg) => Object.assign(new Error(msg), { status });

function decodeImages(images) {
  if (!Array.isArray(images) || !images.length) throw err(400, "Mande pelo menos uma foto.");
  if (images.length > 8) throw err(400, "No máximo 8 fotos por vez.");
  return images.map((im, i) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(im || "");
    if (!m) throw err(400, `A foto ${i + 1} não é uma imagem válida.`);
    return { type: m[1], data: m[2] };
  });
}

async function askClaude(imgs, opts, cellar) {
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  // o que muda pouco (instruções + opções do Notion) fica no system, em cache; o resto vai na mensagem
  const system = [
    { type: "text", text: SCAN_PROMPT },
    { type: "text", text: `Opções de Country: ${opts.country.join(" | ")}\nOpções de Grapes: ${opts.grapes.join(" | ")}\nOpções de Region: ${opts.region.join(" | ")}`, cache_control: { type: "ephemeral" } },
  ];
  const content = [];
  imgs.forEach((im, i) => {
    content.push({ type: "text", text: `Foto ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } });
  });
  content.push({ type: "text", text: `Já na adega (id · nome · safra):\n${cellar.map((w) => `${w.id} · ${w.n} · ${w.s || "s/ safra"}`).join("\n")}\n\nIdentifique os vinhos das fotos e preencha os campos.` });

  const messages = [{ role: "user", content }];
  let final;
  // a busca na web pode pausar o turno; continua até terminar
  for (let i = 0; i < 4; i++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCAN_SCHEMA } },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: ["vivino.com"] }],
      system,
      messages,
    });
    final = await stream.finalMessage();
    if (final.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: final.content });
  }
  if (final.stop_reason === "refusal") throw err(502, "A IA não aceitou analisar essas fotos.");
  if (final.stop_reason === "max_tokens") throw err(502, "A resposta da IA veio cortada. Tente com menos fotos.");
  const text = final.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try { return JSON.parse(text).wines || []; }
  catch { throw err(502, "Não consegui entender a resposta da IA. Tente de novo."); }
}

// sem chave no servidor local de demonstração: devolve um vinho de exemplo para testar a tela
const demoWines = (imgs) => [{ name: "Vinho de teste (demonstração) 2022", winery: "Produtor de teste", country: "Portugal", region: ["Douro"], kinds: ["Red"], grapes: ["Touriga Nacional"], safra: "2022", abv: 13.5, vivino: 3.9, vivino_url: null, bottles: 1, comment: "Cadastro de demonstração: sem ANTHROPIC_API_KEY o servidor local não chama a IA.", existing_id: null, photos: imgs.map((_, i) => i + 1) }];

export async function scan({ images }) {
  const imgs = decodeImages(images);
  const live = !!env("ANTHROPIC_API_KEY");
  if (!live && env("DEMO") !== "1") throw err(500, "ANTHROPIC_API_KEY não configurada no servidor.");
  const [opts, all] = await Promise.all([options(), listAll()]);
  const cellar = all.wines.filter((w) => w.tag === "Cellar");
  const found = live ? await askClaude(imgs, opts, cellar) : demoWines(imgs);
  if (!found.length) throw err(422, "Não reconheci nenhum vinho nas fotos. Tente fotos mais nítidas do rótulo.");

  const N = backend;
  const today = new Date().toISOString().slice(0, 10);
  const uploaded = new Map();                       // foto -> id do upload no Notion (sobe uma vez só)
  const upload = async (n) => {
    if (!uploaded.has(n)) {
      const im = imgs[n - 1];
      const bytes = Uint8Array.from(atob(im.data), (c) => c.charCodeAt(0));
      const name = `rotulo-${today}-${n}.${im.type.split("/")[1].replace("jpeg", "jpg")}`;
      uploaded.set(n, [await N.uploadFile(bytes, name, im.type), name]);
    }
    return uploaded.get(n);
  };

  const items = [];
  for (const w of found) {
    const bottles = Math.max(1, w.bottles || 1);
    const existing = w.existing_id && cellar.find((c) => c.id === cleanId(w.existing_id));
    if (existing) {
      const page = await N.getPage(existing.id);
      const before = Math.max(1, read(page.properties.Bottles) || 1);
      await N.updatePage(existing.id, { Bottles: P.number(before + bottles) });
      items.push({ id: existing.id, name: existing.n, action: "added", bottles, undo: { type: "bottles", id: existing.id, bottles: before } });
      continue;
    }
    let images = [];
    try { images = await Promise.all((w.photos || []).filter((n) => n >= 1 && n <= imgs.length).slice(0, 3).map(upload)); }
    catch { images = []; }                          // sem a foto o cadastro segue
    const r = await create({
      name: w.name, winery: w.winery, country: w.country, region: w.region, kinds: w.kinds, grapes: w.grapes,
      safra: w.safra, abv: w.abv, vivino: w.vivino, link: w.vivino_url, bottles, comment: w.comment,
      purchase: today, images,
    });
    items.push({ id: r.id, name: w.name, action: "created", bottles, undo: r.undo });
  }
  return { items, demo: !live };
}
