-- Safra · avisos no celular. Tabelas próprias no projeto do Fila (não mexe nas fila_*).
-- Sem grants: só a service role (a função cellar) lê e grava.

create table if not exists public.safra_config (
  key   text primary key,
  value text
);
alter table public.safra_config enable row level security;
revoke all on public.safra_config from anon, authenticated;

create table if not exists public.safra_push_subs (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
alter table public.safra_push_subs enable row level security;
revoke all on public.safra_push_subs from anon, authenticated;

create table if not exists public.safra_notify_log (
  id      bigint generated always as identity primary key,
  kind    text not null,
  ref     text,
  title   text,
  body    text,
  url     text,
  sent_at timestamptz not null default now()
);
create index if not exists safra_notify_log_ref_idx on public.safra_notify_log (ref);
alter table public.safra_notify_log enable row level security;
revoke all on public.safra_notify_log from anon, authenticated;

insert into public.safra_config (key, value) values
  ('cron_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- todo dia às 20h de Brasília (23h UTC)
select cron.unschedule('safra-notify') where exists (select 1 from cron.job where jobname = 'safra-notify');
select cron.schedule('safra-notify', '0 23 * * *', $$
  select net.http_post(
    url := 'https://khevvlkznbewbktlmryt.supabase.co/functions/v1/cellar/notify',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'x-cron-key', (select value from public.safra_config where key = 'cron_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
