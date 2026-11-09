// Lê variáveis de ambiente tanto no Node (servidor local) quanto no Deno (Supabase).
export const env = (k) => (globalThis.Deno ? globalThis.Deno.env.get(k) : globalThis.process?.env?.[k]) || undefined;
