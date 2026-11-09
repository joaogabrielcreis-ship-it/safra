// Janela de consumo estimada pelo estilo do vinho — mesmas regras do painel Cellar.
// Serve para ordenar prioridade, não para decretar que um vinho morreu.

const hoje = new Date();
const HOJE_ANO = hoje.getFullYear() + hoje.getMonth() / 12;

const JANELA_BASE = { Tinto: [2, 7], Branco: [1, 4], Laranja: [1, 5], "Rosé": [0, 2], Espumante: [0.5, 4], Fortificado: [3, 30], "Sem tipo": [1, 6] };
const CASTA_GUARDA = new Set(["Cabernet Sauvignon","Cabernet Franc","Malbec","Nebbiolo","Sangiovese","Brunello","Tempranillo","Touriga Nacional","Touriga Franca","Tinta Roriz","Syrah","Tannat",
  "Petit Verdot","Monastrell","Aglianico","Alicante Bouschet","Mourvedre","Bonarda","Carménère","Merlot","Grenache","Garnacha/Grenache","Primitivo","Corvina","Baga","Trincadeira",
  "Plavac Mali","Vranac","Blaufrankisch/Kékfrankos","Refošk","Shesh i Zi","Kratošija","Prokupac","Trnjak","Blatina","Teran"]);
const BRANCA_GUARDA = new Set(["Riesling","Chenin Blanc","Furmint","Vitovska","Rebula","Ribolla Gialla","Malvasia","Žilavka","Semillon","Assyrtiko","Savagnin","Hárslevelű","Pošip","Grk","Friulano","Chardonnay"]);
const REGIAO_GUARDA = new Set(["Ribera del Duero","Rioja","Priorat","Toro","Barolo","Barbaresco","Brunello di Montalcino","Montalcino","Chianti Classico","Chianti Rùfina","Bolgheri","Taurasi",
  "Valpolicella Ripasso","Douro","Dão","Bairrada","Bordeaux","Bourgogne","Saint-Joseph","Côte-Rôtie","Hermitage","Napa Valley","Gualtallary","Paraje Altamira","Dingač","Pelješac","Mosel","Tokaj","Maury"]);
const REGIAO_JOVEM = new Set(["Beaujolais","Vinho Verde","Rias Baixas","Rueda","Txakoli","Valdobbiadene","Prosecco","Asti","Lambrusco","Casablanca","Leyda Valley","San Antonio Valley","Marlborough","Vin de France","Méditerranée"]);
const REG_ESP = /gran reserva/i, REG_ESP2 = /\breserva\b/i, REG_ESP3 = /crianza/i;
const REG_ITA = /riserva/i, REG_FRA = /grand cru|premier cru|1er cru/i, REG_PT = /garrafeira|grande reserva|\breserva\b/i;
const VINHA_VELHA = /vinhas velhas|viñas viejas|old vines|vieilles vignes|single vineyard|parcela|finca|paraje|gran enemigo|grand select/i;
const ESP_TRAD = /método tradicional|metodo tradicional|méthode traditionnelle|traditional method|champenoise|millésime|millesim|franciacorta|\bcava\b|champagne|trento|crémant|brut nature|extra brut|sur lie|vintage|blanc de/i;
const ESP_CHARMAT = /prosecco|moscato|moscatel|\basti\b|lambrusco|frisante|frizzante|charmat|dulce|doce|demi-sec/i;
const FORT_GUARDA = /vintage|\bLBV\b|late bottled|colheita|madeira|pedro xim/i;

export const JAN_LABEL = { passou: "Passou do ponto", ultimo: "Últimos anos", ponto: "No ponto", guardar: "Guardar" };
export const JAN_ORDER = ["passou", "ultimo", "ponto", "guardar"];

function zonaDe(w) {
  const codes = w.pos || [];
  if (!codes.length) return null;
  const amb = codes.some((c) => c.startsWith("AMB")), cli = codes.some((c) => c.startsWith("CLI"));
  return amb && cli ? "mista" : amb ? "ambiente" : "climatizada";
}

export function janelaDe(r) {
  const tipo = r.k || "Sem tipo";
  let safra = parseInt(r.s, 10);
  const nome = r.n || "";
  const porque = [];
  let nv = false;
  if ((!safra || safra < 1900) && tipo === "Fortificado") {
    const base = (r.pur || r.ct || "").slice(0, 4);
    if (!base) return null;
    safra = parseInt(base, 10); nv = true;
  }
  if (!safra || safra < 1900) return null;

  let [ini, fim] = JANELA_BASE[tipo] || JANELA_BASE["Sem tipo"];
  if (nv) {
    if (FORT_GUARDA.test(nome)) { ini = 2; fim = 25; porque.push("fortificado de guarda (vintage/LBV/colheita): 2 a 25 anos da compra"); }
    else { ini = 0; fim = 8; porque.push("tawny/reserve envelhece no barril, não na garrafa: pronto, segura ~8 anos fechado"); }
  } else if (tipo === "Espumante") {
    if (ESP_TRAD.test(nome)) { ini = 1; fim = 8; porque.push("espumante de método tradicional: 1 a 8 anos"); }
    else if (ESP_CHARMAT.test(nome) || (r.g || []).some((g) => /moscat/i.test(g))) { ini = 0; fim = 2.5; porque.push("espumante charmat/moscatel: beber jovem, até 2,5 anos"); }
    else porque.push(`espumante sem método declarado: ${ini} a ${fim} anos`);
  } else porque.push(`base ${tipo.toLowerCase()}: ${ini} a ${fim} anos`);

  const uvas = r.g || [];
  if (!nv && (tipo === "Tinto" || tipo === "Sem tipo")) {
    const nobres = uvas.filter((g) => CASTA_GUARDA.has(g));
    if (nobres.length) { fim += 3; ini += 1; porque.push(`casta de guarda (${nobres.slice(0, 2).join(", ")}): +3 no fim`); }
  }
  if (!nv && (tipo === "Branco" || tipo === "Laranja")) {
    const nobres = uvas.filter((g) => BRANCA_GUARDA.has(g));
    if (nobres.length) { fim += 2; ini += 0.5; porque.push(`branca com estrutura para guarda (${nobres.slice(0, 2).join(", ")}): +2 no fim`); }
  }
  const regs = r.reg || [];
  const rg = regs.find((x) => REGIAO_GUARDA.has(x)), rj = regs.find((x) => REGIAO_JOVEM.has(x));
  if (!nv && rg) { fim += 2; ini += 1; porque.push(`região de guarda (${rg}): +2 no fim, +1 no começo`); }
  else if (!nv && rj) { fim -= 1.5; porque.push(`região de beber jovem (${rj}): −1,5`); }
  if (r.v != null) {
    if (r.v >= 300) { fim += 3; ini += 1; porque.push("acima de R$ 300: +3"); }
    else if (r.v >= 150) { fim += 1.5; porque.push("entre R$ 150 e 300: +1,5"); }
    else if (r.v < 80) { fim -= 1; porque.push("abaixo de R$ 80: −1"); }
  }
  if (r.viv != null) {
    if (r.viv >= 4.3) { fim += 2; porque.push("nota 4,3 ou mais: +2"); }
    else if (r.viv <= 3.8) { fim -= 1; porque.push("nota até 3,8: −1"); }
  }
  if (!nv) {
    const c = r.c || "";
    if (c === "Spain") {
      if (REG_ESP.test(nome)) { fim += 4; ini += 1.5; porque.push("gran reserva (categoria regulada na Espanha): +4"); }
      else if (REG_ESP2.test(nome)) { fim += 2.5; ini += 1; porque.push("reserva (regulado na Espanha): +2,5"); }
      else if (REG_ESP3.test(nome)) { fim += 1.5; ini += 0.5; porque.push("crianza (regulado na Espanha): +1,5"); }
    } else if (c === "Italy" && REG_ITA.test(nome)) { fim += 2; ini += 0.5; porque.push("riserva (regulado na Itália): +2"); }
    else if (c === "France" && REG_FRA.test(nome)) { fim += 3; ini += 1; porque.push("grand/premier cru: +3"); }
    else if (c === "Portugal" && REG_PT.test(nome)) { fim += 1.5; porque.push("reserva/garrafeira (regulado em Portugal): +1,5"); }
    else if (/reserv[ae]|riserva|selection|seleção|selekcija/i.test(nome)) { fim += 0.5; porque.push("“reserva” fora de denominação regulada: só +0,5"); }
    if (VINHA_VELHA.test(nome)) { fim += 1; porque.push("vinha velha / parcela única: +1"); }
  }
  if (!nv && r.nat) {
    if (tipo === "Laranja") porque.push("natural, mas laranja de maceração: sem desconto");
    else { fim -= 1.5; ini = Math.max(0, ini - 0.5); porque.push("vinho natural (pouco sulfito): −1,5 no fim, abre antes"); }
  }
  if (!nv && r.abv != null) {
    if (tipo === "Tinto" && r.abv >= 14.5) { fim += 0.5; porque.push("tinto encorpado (14,5%+): +0,5"); }
    else if ((tipo === "Branco" || tipo === "Rosé") && r.abv <= 11.5) { fim -= 0.5; porque.push("branco leve (até 11,5%): −0,5"); }
  }
  ini = Math.max(0, ini);
  fim = Math.max(ini + 1, fim);
  const zona = zonaDe(r);
  if (zona === "ambiente") { fim = ini + (fim - ini) * 0.78; porque.push("na adega ambiente: janela 22% mais curta"); }
  else if (zona === "mista") { fim = ini + (fim - ini) * 0.88; porque.push("parte na adega ambiente: janela 12% mais curta"); }
  fim = Math.max(ini + 1, fim);

  const idade = HOJE_ANO - safra;
  let status;
  if (idade < ini) status = "guardar";
  else if (idade > fim) status = "passou";
  else if (fim - idade <= 1.5) status = "ultimo";
  else status = "ponto";
  return { safra: nv ? null : safra, nv, zona, ini, fim, idade, status, porque,
    anoIni: safra + ini, anoFim: safra + fim, faltam: ini - idade, sobram: fim - idade, passou: idade - fim };
}

// 0 = abrir já … 5 = guardar por anos (para ordenar a lista)
export function urgencia(j) {
  if (!j) return 2.5;
  if (j.status === "passou") return -j.passou;
  if (j.status === "ultimo") return 1 + j.sobram / 10;
  if (j.status === "ponto") return 2 + j.sobram / 10;
  return 4 + j.faltam / 10;
}
