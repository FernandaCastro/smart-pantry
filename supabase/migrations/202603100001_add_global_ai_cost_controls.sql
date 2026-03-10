create table if not exists public.ai_ip_rate_events (
  id bigserial primary key,
  ip_address text not null,
  feature text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_ip_rate_events_ip_created_at_idx
  on public.ai_ip_rate_events (ip_address, created_at desc);

create index if not exists ai_ip_rate_events_created_at_idx
  on public.ai_ip_rate_events (created_at desc);
