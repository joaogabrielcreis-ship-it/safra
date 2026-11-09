# Safra — app da adega

PWA para celular (nome: Safra) ligado à base **🍷 Cellar** do Notion. O Notion continua sendo a fonte de tudo:
o app lê e grava direto lá, então o painel antigo e o Notion continuam valendo.

Mesmo modelo do Fila: o app fica no **GitHub Pages** e a parte que fala com o Notion é uma
**função do Supabase** (`cellar`, no mesmo projeto do Fila). O token do Notion fica só no Supabase;
o celular manda apenas a senha do app (`CELLAR_PIN`).

**O que faz**
- **Adega**: busca (nome, produtor, uva, país, vão), filtros por tipo e lugar, ordenação por "abrir primeiro".
- **Ficha** do vinho: janela de consumo estimada (com o porquê), posição, dados, link para o Notion e o Vivino.
- **Bebi esta**: marca como bebido (data, onde, com quem, nota, comentário). Com várias garrafas, cria um
  registro "Had" e desconta uma da adega — mesma regra do painel.
- **Posições**: desenho das duas adegas. Toque num vão livre para colocar um vinho; numa garrafa para ver,
  mover (troca se o destino estiver ocupado) ou tirar.
- **Nova garrafa**: cadastro com tipo, país, uvas, região, preço, viagem e vão livre.
- **Números**: os painéis do dashboard antigo, em sub-abas: Consumo (mês a mês, ano a ano, tipos, com quem,
  onde, dia da semana), Adega (valor, país, tipo, safra, mais caras), Viagens, Tempo de adega, Preço & nota
  (preço × Vivino, faixas, custo-benefício) e Origens (países, castas, regiões, produtores, país × casta).
- **Cadastro por foto**: escolha ou tire várias fotos de rótulos de uma vez; a IA (Claude, com busca no Vivino)
  identifica os vinhos, grava no Notion com a foto no campo Image e sugere o vão. As instruções da IA estão em
  `server/scan-prompt.js` (troque pelo texto da sua skill de cadastro, se quiser).
- **O que abrir hoje**: escolha tipo, comida e orçamento; o app sugere três garrafas e diz onde estão.
- **Sugestão de vão**: climatizada para guarda, brancos, laranjas, espumantes e garrafas caras; ambiente para tintos de beber logo.
- **Completar dados** e **Editar**: lista do que falta (preço, safra, Vivino, uvas, nota) e edição rápida.
- **Desfazer** depois de "bebi", mover, cadastrar.
- **Sem internet**: o "Bebi" fica guardado no celular e é enviado quando a conexão volta.
- **Avisos no celular** (às 20h): "Como estava?" no dia seguinte a uma garrafa sem nota e resumo da adega aos domingos.
- Abre offline com a última leitura.

## Pastas
```
docs/                        o app (HTML/CSS/JS puro, sem build) — é o que o GitHub Pages publica
server/                      rotas e regras (Notion, bebi, posições, cadastro), usadas pelos dois lados
supabase/functions/cellar/   entrada da função do Supabase (sobe junto com os arquivos de server/)
dev-server.mjs               servidor local
```

## Rodar no computador
```bash
npm run demo          # dados de exemplo em memória, senha: demo
```
(gere antes `fixtures/pages.json` com `node tools/make-fixture.mjs <html do painel>`).
Com o Notion de verdade: copie `.env.example` para `.env`, preencha e rode `npm run dev`.

## Segredos no Supabase (projeto do Fila → Edge Functions → Secrets)
- `CELLAR_PIN` — a senha que o app pede. Use algo longo.
- `CELLAR_NOTION_TOKEN` — só se a integração do Cellar for diferente da do Fila; sem ele, a função usa o
  `NOTION_TOKEN` que já existe. Em qualquer caso, a integração precisa estar conectada às bases
  Cellar e ✈️ Travel Plans (no Notion: base → `•••` → Conexões).

- `ANTHROPIC_API_KEY` — chave da API do Claude, para o cadastro por foto.

Para os avisos, a migração `supabase/migrations/20261109180000_safra_push.sql` cria as tabelas `safra_*` e o
agendamento diário (pg_cron) no mesmo projeto do Fila.

A função sobe com estes arquivos lado a lado: `index.ts`, `deno.json`, e de `server/`: `env.js`, `router.js`,
`notion.js`, `cellar.js`, `scan.js`, `scan-prompt.js`, `push.js`, `janela.js` (este é cópia de `docs/janela.js`).

Para conferir: `GET https://khevvlkznbewbktlmryt.supabase.co/functions/v1/cellar/health`
responde se a senha está configurada e se o Notion está acessível.

## Publicar o app
Repositório `cellar`, com o GitHub Pages publicando a pasta `docs/` da branch `main`.
Endereço: https://joaogabrielcreis-ship-it.github.io/cellar/

**Entrar sem digitar senha** (como no Grifo e no Fila): abra o link com a senha no fim,
`https://joaogabrielcreis-ship-it.github.io/cellar/#k=SUA_SENHA` (se a senha tiver espaço ou símbolos,
use a versão codificada para URL). O app guarda a chave e não pede mais. Esse link *é* a senha: não
compartilhe. Sem o `#k=`, o app mostra a tela de senha.

No iPhone: abra o link com `#k=` no Safari → Compartilhar → *Adicionar à Tela de Início*. O ícone
guarda o endereço com a chave (o app da Tela de Início tem armazenamento separado do Safari).
