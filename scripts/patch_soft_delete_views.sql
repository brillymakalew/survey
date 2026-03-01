-- ============================================================
-- Multi-Phase Questionnaire App - Soft Delete Patch
-- Run this entire file in the Supabase SQL Editor
-- This script updates the 6 analytics views to exclude 
-- respondents where status = 'deleted'.
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
left join phase_progress ppc on ppc.respondent_id = r.id and ppc.phase_id = spc.id
where r.status != 'deleted';

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
left join respondents r on r.id = pp.respondent_id
where r.status != 'deleted'
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
join respondents r on r.id = sr.respondent_id
cross join lateral jsonb_array_elements_text(
  case jsonb_typeof(sr.answer_value_json)
    when 'array' then sr.answer_value_json
    else jsonb_build_array(sr.answer_value_json)
  end
) as t(opt_value)
where sq.question_type in ('single_choice', 'multi_select')
  and r.status != 'deleted'
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
join respondents r on r.id = sr.respondent_id
where sq.question_type = 'likert'
  and r.status != 'deleted'
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
where r.status != 'deleted'
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
    / nullif((select count(*) from respondents where status != 'deleted'), 0) * 100, 1
  )                                 as pct
from respondents r
left join intent_q i on i.respondent_id = r.id
where r.status != 'deleted'
group by i.intent
order by respondent_count desc;
