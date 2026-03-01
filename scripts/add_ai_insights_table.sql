-- ============================================================
-- Create table to store generated AI Summaries
-- ============================================================

create table if not exists ai_insights (
  id           uuid primary key default gen_random_uuid(),
  summary_text text not null,
  created_at   timestamptz not null default now()
);

-- Index to quickly get the latest summary
create index if not exists idx_ai_insights_created_at on ai_insights(created_at desc);
