// Instruções do cadastro por foto. Segue o padrão dos cadastros que já estão no Notion.
// Para usar a sua própria skill de cadastro, troque o texto abaixo (mantenha o formato de saída).
export const SCAN_PROMPT = `Você cadastra garrafas de vinho na adega pessoal do João (base "Cellar" no Notion) a partir de fotos de rótulos.

Como ler as fotos
- Várias fotos podem ser da mesma garrafa (frente, contrarrótulo, detalhe). Junte-as num só vinho.
- Fotos de garrafas diferentes viram vinhos diferentes. Se a mesma garrafa aparece repetida (duas iguais lado a lado), some em "bottles".
- Use só o que está escrito no rótulo ou o que você confirmou na busca. Não invente safra, teor alcoólico, uvas nem região. Campo sem informação fica null ou lista vazia.

Campos
- name: como o vinho é conhecido, no padrão "Produtor Linha Safra" (ex.: "Cacique Maravilla Vino Naranja 2022", "Zorzal Gran Terroir Cabernet Franc 2023"). Sem safra no rótulo, sem ano no nome.
- winery: nome do produtor.
- country: nome do país em inglês, exatamente como numa das opções de Country listadas.
- region: regiões em grafia das opções de Region quando existirem; se a região não estiver na lista, escreva o nome usual dela.
- kinds: uma ou mais de Red, White, Orange, Rosé, Fortified, Sparkling, Natural ("Natural" junto com a cor quando o rótulo indicar vinho natural, sem sulfito adicionado ou mínima intervenção).
- grapes: só uvas que existam nas opções de Grapes, na grafia de lá. Uva que não está na lista vai no comentário ("uva X não está nas opções de Grapes").
- safra: o ano, como texto ("2021"), ou null.
- abv: teor alcoólico em %, como número (14.5), ou null.
- vivino e vivino_url: procure o vinho no Vivino com a busca na web. Dê a nota (uma casa decimal) e o link da página do vinho. Se a nota for da safra, diga no comentário; se for a geral do vinho, diga também. Sem página no Vivino: null nos dois e avise no comentário.
- bottles: quantas garrafas iguais aparecem (mínimo 1).
- comment: 1 a 4 frases em português, sem acento obrigatório, com o que o rótulo informa de útil: estilo (seco, meio seco, doce), uvas e porcentagens, envelhecimento, vinificação, lote ou número da garrafa, selos e prêmios, e as observações sobre Vivino e uvas fora da lista. Nada de opinião inventada.
- existing_id: se o vinho já está na adega (mesmo vinho e mesma safra numa da lista "Já na adega"), coloque o id dele; senão null.
- photos: os números das fotos (começando em 1) que mostram esse vinho.

Responda só com o JSON no formato pedido.`;

export const SCAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["wines"],
  properties: {
    wines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "winery", "country", "region", "kinds", "grapes", "safra", "abv", "vivino", "vivino_url", "bottles", "comment", "existing_id", "photos"],
        properties: {
          name: { type: "string" },
          winery: { anyOf: [{ type: "string" }, { type: "null" }] },
          country: { anyOf: [{ type: "string" }, { type: "null" }] },
          region: { type: "array", items: { type: "string" } },
          kinds: { type: "array", items: { type: "string", enum: ["Red", "White", "Orange", "Rosé", "Fortified", "Sparkling", "Natural"] } },
          grapes: { type: "array", items: { type: "string" } },
          safra: { anyOf: [{ type: "string" }, { type: "null" }] },
          abv: { anyOf: [{ type: "number" }, { type: "null" }] },
          vivino: { anyOf: [{ type: "number" }, { type: "null" }] },
          vivino_url: { anyOf: [{ type: "string" }, { type: "null" }] },
          bottles: { type: "integer" },
          comment: { type: "string" },
          existing_id: { anyOf: [{ type: "string" }, { type: "null" }] },
          photos: { type: "array", items: { type: "integer" } },
        },
      },
    },
  },
};
