create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  feature text not null,
  request_chars integer,
  response_chars integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_id_created_at_idx
  on public.ai_usage (user_id, created_at desc);
