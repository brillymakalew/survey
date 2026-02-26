-- ============================================================
-- Seed Data for Multi-Phase Questionnaire App
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- Survey Panels  (phase_code now uses panel_1/panel_2/panel_3/closing)
-- ============================================================
insert into survey_phases (phase_code, phase_name, sort_order, is_active) values
  ('panel_1', 'Panel 1: Ideation (T0-T1)',             1, true),
  ('panel_2', 'Panel 2: Prototyping-Trials (T2-T3)',   2, true),
  ('panel_3', 'Panel 3: Scale-Up (T4-T5)',             3, true),
  ('closing', 'Closing Survey: Questionnaire Action',  4, true)
on conflict (phase_code) do nothing;

-- ============================================================
-- Panel 1 Questions: T0-T1 (Ideation)
-- Includes: Affiliation + Country Base (only asked in Panel 1)
-- ============================================================
insert into survey_questions
  (phase_id, question_code, section_code, prompt, help_text,
   question_type, options_json, selection_min, selection_max,
   is_required, conditional_logic_json, sort_order, is_active)
select
  sp.id,
  q.question_code,
  q.section_code,
  q.prompt,
  q.help_text,
  q.question_type,
  q.options_json::jsonb,
  q.selection_min,
  q.selection_max,
  q.is_required,
  q.conditional_logic_json::jsonb,
  q.sort_order,
  true
from survey_phases sp,
(values
  ('affiliation_type',
   'identity',
   'What is your primary affiliation?',
   'Please select the one that best describes your role.',
   'single_choice',
   '["Academia","Industry","Government","Other"]',
   1, 1, true, null, 1),

  ('affiliation_type_other',
   'identity',
   'Please specify your affiliation:',
   null,
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"affiliation_type","answer_in":["Other"]}}', 2),

  ('country_base',
   'identity',
   'Which country base best describes you?',
   'Select the option that applies to your primary work/research location.',
   'single_choice',
   '["Indonesia","UK","Both","Other"]',
   1, 1, true, null, 3),

  ('t01_clarity',
   't01',
   'After Panel 1, my understanding of research translation is clearer.',
   'Rate from 1 (Strongly Disagree) to 7 (Strongly Agree).',
   'likert',
   null,
   null, null, true, null, 4),

  ('t01_bottlenecks',
   't01',
   'What are your top 2 bottlenecks at the initiation of research?',
   'Select exactly 2 items.',
   'multi_select',
   '["Lack of funding","Limited collaboration networks","No clear pathway to industry adoption","Regulatory barriers","Insufficient institutional support","Lack of industry demand signals","Poor communication between academia and industry","Other"]',
   2, 2, true, null, 5),

  ('t01_bottlenecks_other',
   't01',
   'Please describe your "Other" bottleneck:',
   null,
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"t01_bottlenecks","answer_in":["Other"]}}', 6),

  ('t01_enablers',
   't01',
   'What are your top 2 enabling conditions to produce a discovery?',
   'Select exactly 2 items.',
   'multi_select',
   '["Interdisciplinary team","Access to funding","Industry partnership","Supportive policy environment","Access to data/infrastructure","Mentorship and expertise","Research translation training","Other"]',
   2, 2, true, null, 7),

  ('t01_enablers_other',
   't01',
   'Please describe your "Other" enabling condition:',
   null,
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"t01_enablers","answer_in":["Other"]}}', 8)

) as q(question_code, section_code, prompt, help_text, question_type, options_json,
       selection_min, selection_max, is_required, conditional_logic_json, sort_order)
where sp.phase_code = 'panel_1'
on conflict (question_code) do nothing;

-- ============================================================
-- Panel 2 Questions: T2-T3 (Prototyping-Trials)
-- No identity questions — affiliation/country already captured in Panel 1
-- ============================================================
insert into survey_questions
  (phase_id, question_code, section_code, prompt, help_text,
   question_type, options_json, selection_min, selection_max,
   is_required, conditional_logic_json, sort_order, is_active)
select
  sp.id,
  q.question_code,
  q.section_code,
  q.prompt,
  q.help_text,
  q.question_type,
  q.options_json::jsonb,
  q.selection_min,
  q.selection_max,
  q.is_required,
  q.conditional_logic_json::jsonb,
  q.sort_order,
  true
from survey_phases sp,
(values
  ('t23_clarity',
   't23',
   'After Panel 2, my understanding of research translation is clearer.',
   'Rate from 1 (Strongly Disagree) to 7 (Strongly Agree).',
   'likert',
   null,
   null, null, true, null, 1),

  ('t23_challenges',
   't23',
   'What are your top 2 biggest challenges at this stage?',
   'Select exactly 2 items.',
   'multi_select',
   '["Moving from lab to prototype","Securing pilot partnerships","Regulatory and compliance hurdles","Scaling production","IP and commercialization barriers","Finding end-users for trials","Sustaining funding during transition","Other"]',
   2, 2, true, null, 2),

  ('t23_challenges_other',
   't23',
   'Please describe your "Other" challenge:',
   null,
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"t23_challenges","answer_in":["Other"]}}', 3),

  ('t23_enablers',
   't23',
   'What are your top 2 enablers at the prototyping and trials stage?',
   'Select exactly 2 items.',
   'multi_select',
   '["Industry co-investment","Government grants","Technology transfer office support","User/community engagement","Incubator/accelerator access","Cross-border collaboration","Flexible regulatory pathways","Other"]',
   2, 2, true, null, 4),

  ('t23_enablers_other',
   't23',
   'Please describe your "Other" enabler:',
   null,
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"t23_enablers","answer_in":["Other"]}}', 5)

) as q(question_code, section_code, prompt, help_text, question_type, options_json,
       selection_min, selection_max, is_required, conditional_logic_json, sort_order)
where sp.phase_code = 'panel_2'
on conflict (question_code) do nothing;

-- ============================================================
-- Panel 3: T4-T5 Placeholder
-- No questions defined yet — insert via SQL when content is ready.
-- ============================================================

-- ============================================================
-- Closing Survey Questions
-- No identity questions — affiliation/country already captured in Panel 1
-- ============================================================
insert into survey_questions
  (phase_id, question_code, section_code, prompt, help_text,
   question_type, options_json, selection_min, selection_max,
   is_required, conditional_logic_json, sort_order, is_active)
select
  sp.id,
  q.question_code,
  q.section_code,
  q.prompt,
  q.help_text,
  q.question_type,
  q.options_json::jsonb,
  q.selection_min,
  q.selection_max,
  q.is_required,
  q.conditional_logic_json::jsonb,
  q.sort_order,
  true
from survey_phases sp,
(values
  ('closing_clarity',
   'reflection',
   'After the whole sessions, my understanding of research translation is clearer.',
   'Rate from 1 (Strongly Disagree) to 7 (Strongly Agree).',
   'likert',
   null,
   null, null, true, null, 1),

  ('breakout_group',
   'reflection',
   'Which breakout group did you join?',
   null,
   'single_choice',
   '["Group A: Ideation","Group B: Prototyping","Group C: Scale-Up","Group D: Policy & Ecosystem","I did not join a breakout group"]',
   1, 1, true, null, 2),

  ('top_priorities',
   'reflection',
   'What are your top 3 priorities to build equitable UK-Indonesia research translation pathways?',
   'Select exactly 3 items.',
   'multi_select',
   '["Joint funding mechanisms","Talent mobility programs","IP sharing frameworks","Regulatory harmonization","Community engagement","Technology transfer offices","Digital collaboration platforms","Knowledge exchange programs","Other"]',
   3, 3, true, null, 3),

  ('top_priorities_other',
   'reflection',
   'Please describe your "Other" priority:',
   null,
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"top_priorities","answer_in":["Other"]}}', 4),

  ('collaboration_intent',
   'collaboration',
   'Do you intend to pursue a collaboration or proposal after this forum?',
   null,
   'single_choice',
   '["Yes","No","Maybe"]',
   1, 1, true, null, 5),

  ('proposal_title',
   'collaboration',
   'If yes or maybe: what is your proposal idea title?',
   'Optional — share an idea you would like to explore.',
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"collaboration_intent","answer_in":["Yes","Maybe"]}}', 6),

  ('share_permission',
   'collaboration',
   'Do you give permission to share this idea with organizers for follow-up matchmaking?',
   null,
   'single_choice',
   '["Yes","No"]',
   1, 1, false,
   '{"show_if":{"question_code":"collaboration_intent","answer_in":["Yes","Maybe"]}}', 7),

  ('contact_email',
   'collaboration',
   'Please provide your email address for follow-up:',
   'Required if you granted permission to share your idea.',
   'short_text',
   null,
   null, null, false,
   '{"show_if":{"question_code":"share_permission","answer_in":["Yes"]}}', 8)

) as q(question_code, section_code, prompt, help_text, question_type, options_json,
       selection_min, selection_max, is_required, conditional_logic_json, sort_order)
where sp.phase_code = 'closing'
on conflict (question_code) do nothing;

-- ============================================================
-- Admin User (MVP)
-- password: password123 (bcrypt hash)
-- Regenerate: node -e "require('bcryptjs').hash('password123',12).then(console.log)"
-- ============================================================
insert into admin_users (username, password_hash)
values (
  'admin',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
)
on conflict (username) do nothing;
