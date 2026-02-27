-- ============================================================
-- Multi-Phase Questionnaire App - Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- PRD Reference: §8 Data Model
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLE: respondents   (PRD §8.1.1)
-- ============================================================
create table if not exists respondents (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null,
  phone_raw          text not null,
  phone_normalized   text not null unique,
  latest_session_id  uuid,
  current_phase      text not null default 'phase_1',
  status             text not null default 'active',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_seen_at       timestamptz
);

create index if not exists idx_respondents_phone on respondents(phone_normalized);
create index if not exists idx_respondents_status on respondents(status);

-- ============================================================
-- TABLE: response_sessions   (PRD §8.1.2)
-- ============================================================
create table if not exists response_sessions (
  id                  uuid primary key default gen_random_uuid(),
  respondent_id       uuid not null references respondents(id) on delete cascade,
  session_token       text unique not null default gen_random_uuid()::text,
  status              text not null default 'active',  -- active | completed | expired
  resume_key_version  integer not null default 1,
  last_phase          text,
  last_step_code      text,
  started_at          timestamptz not null default now(),
  last_activity_at    timestamptz not null default now(),
  completed_at        timestamptz,
  client_fingerprint  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_sessions_respondent on response_sessions(respondent_id);
create index if not exists idx_sessions_token      on response_sessions(session_token);
create index if not exists idx_sessions_status     on response_sessions(status);

-- ============================================================
-- TABLE: survey_phases   (PRD §8.1.3)
-- ============================================================
create table if not exists survey_phases (
  id          uuid primary key default gen_random_uuid(),
  phase_code  text unique not null,  -- phase_1 | phase_2 | phase_3 | closing
  phase_name  text not null,
  sort_order  integer not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABLE: survey_questions   (PRD §8.1.4)
-- ============================================================
create table if not exists survey_questions (
  id                     uuid primary key default gen_random_uuid(),
  phase_id               uuid not null references survey_phases(id) on delete cascade,
  question_code          text unique not null,
  section_code           text,
  prompt                 text not null,
  help_text              text,
  question_type          text not null,  -- single_choice | multi_select | likert | short_text | long_text
  options_json           jsonb,          -- array of option strings
  selection_min          integer,
  selection_max          integer,
  is_required            boolean not null default true,
  conditional_logic_json jsonb,          -- {"show_if":{"question_code":"x","answer_in":["y"]}}
  sort_order             integer not null,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_questions_phase on survey_questions(phase_id, sort_order);

-- ============================================================
-- TABLE: survey_responses   (PRD §8.1.5)
-- Unique per respondent+question (latest-state model)
-- ============================================================
create table if not exists survey_responses (
  id                 uuid primary key default gen_random_uuid(),
  respondent_id      uuid not null references respondents(id) on delete cascade,
  session_id         uuid not null references response_sessions(id) on delete cascade,
  phase_id           uuid not null references survey_phases(id),
  question_id        uuid not null references survey_questions(id),
  answer_value_json  jsonb not null,
  answer_text        text,
  is_finalized       boolean not null default false,
  answered_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique(respondent_id, question_id)
);

create index if not exists idx_responses_respondent on survey_responses(respondent_id);
create index if not exists idx_responses_session    on survey_responses(session_id);
create index if not exists idx_responses_question   on survey_responses(question_id);
create index if not exists idx_responses_phase      on survey_responses(phase_id);

-- ============================================================
-- TABLE: phase_progress   (PRD §8.1.6)
-- ============================================================
create table if not exists phase_progress (
  id                 uuid primary key default gen_random_uuid(),
  respondent_id      uuid not null references respondents(id) on delete cascade,
  phase_id           uuid not null references survey_phases(id),
  status             text not null default 'not_started',  -- not_started | in_progress | completed
  started_at         timestamptz,
  completed_at       timestamptz,
  last_step_code     text,
  completion_percent numeric(5,2) not null default 0,
  updated_at         timestamptz not null default now(),
  unique(respondent_id, phase_id)
);

create index if not exists idx_progress_respondent on phase_progress(respondent_id);
create index if not exists idx_progress_status     on phase_progress(status);

-- ============================================================
-- TABLE: admin_users   (PRD §8.1.7)
-- ============================================================
create table if not exists admin_users (
  id             uuid primary key default gen_random_uuid(),
  username       text unique not null,
  password_hash  text not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- TABLE: audit_logs   (PRD §8.1.8)
-- ============================================================
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_type   text not null,  -- respondent | admin | system
  actor_id     text,
  event_type   text not null,
  entity_type  text not null,
  entity_id    text,
  payload_json jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_event_type on audit_logs(event_type);
create index if not exists idx_audit_actor      on audit_logs(actor_type, actor_id);
create index if not exists idx_audit_created    on audit_logs(created_at desc);

-- ============================================================
-- ANALYTICS VIEWS   (PRD §8.2)
-- ============================================================

-- View 1: Response Funnel
create or replace view vw_response_funnel as
select
  count(distinct r.id)                                                             as total_respondents,
  count(distinct r.id) filter (where pp1.status in ('in_progress','completed'))    as phase1_started,
  count(distinct r.id) filter (where pp1.status = 'completed')                     as phase1_completed,
  count(distinct r.id) filter (where pp2.status = 'completed')                     as phase2_completed,
  count(distinct r.id) filter (where pp3.status = 'completed')                     as phase3_completed,
  count(distinct r.id) filter (where ppc.status = 'completed')                     as closing_completed
from respondents r
left join survey_phases sp1 on sp1.phase_code = 'panel_1'
left join survey_phases sp2 on sp2.phase_code = 'panel_2'
left join survey_phases sp3 on sp3.phase_code = 'panel_3'
left join survey_phases spc on spc.phase_code = 'closing'
left join phase_progress pp1 on pp1.respondent_id = r.id and pp1.phase_id = sp1.id
left join phase_progress pp2 on pp2.respondent_id = r.id and pp2.phase_id = sp2.id
left join phase_progress pp3 on pp3.respondent_id = r.id and pp3.phase_id = sp3.id
left join phase_progress ppc on ppc.respondent_id = r.id and ppc.phase_id = spc.id;

-- View 2: Phase Completion Stats
create or replace view vw_phase_completion_stats as
select
  sp.phase_code,
  sp.phase_name,
  count(pp.id)                                                                   as total_with_progress,
  count(pp.id) filter (where pp.status = 'completed')                            as completed_count,
  round(
    count(pp.id) filter (where pp.status = 'completed')::numeric
    / nullif(count(pp.id), 0) * 100, 1
  )                                                                               as completion_rate_pct,
  round(avg(
    extract(epoch from (pp.completed_at - pp.started_at)) / 60
  ) filter (where pp.completed_at is not null), 1)                               as avg_completion_minutes
from survey_phases sp
left join phase_progress pp on pp.phase_id = sp.id
group by sp.id, sp.phase_code, sp.phase_name, sp.sort_order
order by sp.sort_order;

-- View 3: Question Option Counts (for single_choice / multi_select)
create or replace view vw_question_option_counts as
select
  sq.question_code,
  sq.prompt,
  sq.question_type,
  sp.phase_code,
  t.opt_value,
  count(*) as selection_count
from survey_responses sr
join survey_questions sq on sq.id = sr.question_id
join survey_phases    sp on sp.id = sq.phase_id
cross join lateral jsonb_array_elements_text(
  case jsonb_typeof(sr.answer_value_json)
    when 'array' then sr.answer_value_json
    else jsonb_build_array(sr.answer_value_json)
  end
) as t(opt_value)
where sq.question_type in ('single_choice', 'multi_select')
group by sq.question_code, sq.prompt, sq.question_type, sp.phase_code, t.opt_value
order by sq.question_code, selection_count desc;

-- View 4: Likert Summary
create or replace view vw_likert_summary as
select
  sq.question_code,
  sq.prompt,
  sp.phase_code,
  round(avg((sr.answer_value_json #>> '{}')::numeric), 2) as avg_score,
  count(*)                                                 as response_count,
  min((sr.answer_value_json #>> '{}')::numeric)           as min_score,
  max((sr.answer_value_json #>> '{}')::numeric)           as max_score
from survey_responses sr
join survey_questions sq on sq.id = sr.question_id
join survey_phases    sp on sp.id = sq.phase_id
where sq.question_type = 'likert'
group by sq.question_code, sq.prompt, sp.phase_code;

-- View 5: Affiliation × Country Breakdown (for Crosstabs)
create or replace view vw_affiliation_country_breakdown as
with affiliation_q as (
  select sr.respondent_id, sr.answer_value_json #>> '{}' as affiliation
  from survey_responses sr
  join survey_questions sq on sq.id = sr.question_id
  where sq.question_code in ('affiliation_type', 'closing_affiliation_type', 't23_affiliation_type')
),
aff_ranked as (
  select respondent_id, affiliation,
         row_number() over (partition by respondent_id order by affiliation) as rn
  from affiliation_q
),
country_q as (
  select sr.respondent_id, sr.answer_value_json #>> '{}' as country_base
  from survey_responses sr
  join survey_questions sq on sq.id = sr.question_id
  where sq.question_code in ('country_base', 'closing_country_base', 't23_country_base')
),
ctry_ranked as (
  select respondent_id, country_base,
         row_number() over (partition by respondent_id order by country_base) as rn
  from country_q
)
select
  coalesce(a.affiliation, 'Unknown') as affiliation,
  coalesce(c.country_base, 'Unknown') as country_base,
  count(distinct r.id)                as respondent_count
from respondents r
left join aff_ranked  a on a.respondent_id = r.id and a.rn = 1
left join ctry_ranked c on c.respondent_id = r.id and c.rn = 1
group by a.affiliation, c.country_base
order by respondent_count desc;

-- View 6: Collaboration Intent Summary
create or replace view vw_collaboration_intent_summary as
with intent_q as (
  select sr.respondent_id, sr.answer_value_json #>> '{}' as intent
  from survey_responses sr
  join survey_questions sq on sq.id = sr.question_id
  where sq.question_code = 'collaboration_intent'
)
select
  coalesce(i.intent, 'No Response') as intent,
  count(distinct r.id)              as respondent_count,
  round(
    count(distinct r.id)::numeric
    / nullif((select count(*) from respondents), 0) * 100, 1
  )                                 as pct
from respondents r
left join intent_q i on i.respondent_id = r.id
group by i.intent
order by respondent_count desc;
