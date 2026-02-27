-- Patch to fix the response funnel failing to show completed panels after the URL renaming update
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
