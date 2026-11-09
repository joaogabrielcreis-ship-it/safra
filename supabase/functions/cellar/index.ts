// Cellar — função do Supabase que faz a ponte entre o app (GitHub Pages) e o Notion.
// As rotas estão em server/: no deploy, os arquivos de server/ sobem junto, ao lado deste.
import { handle } from "./router.js";

const ALLOWED = ["https://joaogabrielcreis-ship-it.github.io", "http://localhost:5173", "http://localhost:5174"];

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-cellar-pin, x-cron-key, authorization, apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/(functions\/v1\/)?cellar/, "") || "/";
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const out = await handle({ method: req.method, path, pin: req.headers.get("x-cellar-pin"), cron: req.headers.get("x-cron-key"), body });
  return new Response(JSON.stringify(out.body), {
    status: out.status,
    headers: { ...h, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
});
