-- ============================================================
-- Fix: Clean up old/duplicate phase data
-- Run in Supabase SQL Editor → New Query
-- ============================================================

-- Step 1: Delete all responses linked to old phase_1/phase_2/phase_3 questions
-- (via the response_sessions that belong to those phases)
DELETE FROM survey_responses
WHERE question_id IN (
  SELECT id FROM survey_questions
  WHERE phase_id IN (
    SELECT id FROM survey_phases WHERE phase_code IN ('phase_1','phase_2','phase_3')
  )
);

-- Step 2: Also delete responses for the specific affiliation/country 
-- questions that shouldn't be in panel_2
DELETE FROM survey_responses
WHERE question_id IN (
  SELECT id FROM survey_questions
  WHERE question_code IN ('t23_affiliation_type','t23_affiliation_type_other','t23_country_base')
);

-- Step 3: Now delete the affiliation/country questions from panel_2
DELETE FROM survey_questions
WHERE question_code IN ('t23_affiliation_type','t23_affiliation_type_other','t23_country_base');

-- Step 4: Delete questions under old phase_1/phase_2/phase_3 rows
DELETE FROM survey_questions
WHERE phase_id IN (
  SELECT id FROM survey_phases WHERE phase_code IN ('phase_1','phase_2','phase_3')
);

-- Step 5: Delete phase_progress for old phase rows
DELETE FROM phase_progress
WHERE phase_id IN (
  SELECT id FROM survey_phases WHERE phase_code IN ('phase_1','phase_2','phase_3')
);

-- Step 6: Delete the old duplicate phase rows
DELETE FROM survey_phases
WHERE phase_code IN ('phase_1','phase_2','phase_3');

-- Step 7: Verify final state
SELECT phase_code, phase_name FROM survey_phases ORDER BY sort_order;

SELECT sp.phase_code, sq.question_code
FROM survey_questions sq
JOIN survey_phases sp ON sp.id = sq.phase_id
ORDER BY sp.sort_order, sq.sort_order;
