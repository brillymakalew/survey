/**
 * Final cleanup: 
 * 1. Delete t23_affiliation_type, t23_country_base from panel_2
 * 2. Delete everything under phase_1 and phase_2 phase rows, then delete those rows
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://tiyxkuiznwuzibkqonsk.supabase.co',
    'sb_publishable_0wjA7QPjAGb5VS4oMoOn8g_UHY3Jw5P'
);

const REMOVE_FROM_PANEL2 = [
    't23_affiliation_type',
    't23_affiliation_type_other',
    't23_country_base',
];

(async () => {
    const { data: phases } = await s.from('survey_phases').select('id,phase_code').order('sort_order');
    const byCode = Object.fromEntries(phases.map(p => [p.phase_code, p.id]));
    console.log('Phases found:', Object.keys(byCode));

    // Remove affiliation/country from panel_2
    const panel2id = byCode['panel_2'];
    if (panel2id) {
        for (const code of REMOVE_FROM_PANEL2) {
            const { error } = await s.from('survey_questions').delete().eq('question_code', code).eq('phase_id', panel2id);
            console.log(`Delete ${code} from panel_2:`, error ? error.message : 'OK');
        }
    }

    // Delete all questions under old phase_1 / phase_2 rows (stale), then the phase rows
    for (const oldCode of ['phase_1', 'phase_2', 'phase_3']) {
        const oldId = byCode[oldCode];
        if (!oldId) { console.log(`${oldCode} not in DB, skip`); continue; }

        // Delete questions under this old phase
        const { data: staleQs } = await s.from('survey_questions').select('id,question_code').eq('phase_id', oldId);
        console.log(`\n${oldCode} has ${staleQs?.length || 0} stale questions`);
        if (staleQs?.length) {
            const { error } = await s.from('survey_questions').delete().eq('phase_id', oldId);
            console.log(`  Deleted stale questions:`, error ? error.message : 'OK');
        }

        // Delete phase_progress under old phase
        const { error: ppErr } = await s.from('phase_progress').delete().eq('phase_id', oldId);
        console.log(`  Deleted phase_progress:`, ppErr ? ppErr.message : 'OK');

        // Now delete the phase row
        const { error: delErr } = await s.from('survey_phases').delete().eq('id', oldId);
        console.log(`  Deleted ${oldCode} row:`, delErr ? delErr.message : 'OK');
    }

    // Final state
    const { data: fp } = await s.from('survey_phases').select('id,phase_code,phase_name').order('sort_order');
    const { data: fq } = await s.from('survey_questions').select('phase_id,question_code').order('sort_order');
    const phaseMap = Object.fromEntries(fp.map(p => [p.id, p.phase_code]));

    const grouped = {};
    fq?.forEach(q => {
        const code = phaseMap[q.phase_id] || '?';
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push(q.question_code);
    });

    console.log('\n=== FINAL PHASES ===');
    fp?.forEach(p => console.log(p.phase_code, '|', p.phase_name));
    console.log('\n=== QUESTIONS BY PANEL ===');
    Object.entries(grouped).forEach(([panel, qs]) => console.log(`${panel} (${qs.length}):`, qs.join(', ')));
})();
