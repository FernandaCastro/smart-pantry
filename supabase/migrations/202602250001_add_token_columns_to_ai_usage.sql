alter table if exists public.ai_usage
  add column if not exists request_tokens integer,
  add column if not exists response_tokens integer,
  add column if not exists total_tokens integer,
  add column if not exists provider text,
  add column if not exists model text;

create index if not exists ai_usage_user_feature_created_at_idx
  on public.ai_usage (user_id, feature, created_at desc);
