const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://tiyxkuiznwuzibkqonsk.supabase.co',
    'sb_publishable_0wjA7QPjAGb5VS4oMoOn8g_UHY3Jw5P'
);
(async () => {
    const { data: respondents } = await s.from('respondents').select('id,full_name,phone_normalized,current_phase,status,created_at').order('created_at', { ascending: false }).limit(10);
    console.log('\n=== RESPONDENTS ===');
    respondents?.forEach(r => console.log(r.full_name, '|', r.phone_normalized, '|', r.current_phase, '|', r.id));

    if (respondents?.length) {
        const ids = respondents.map(r => r.id);
        const { data: progress } = await s.from('phase_progress').select('respondent_id,phase_id,status').in('respondent_id', ids);
        const { data: phases } = await s.from('survey_phases').select('id,phase_code');
        const phaseMap = Object.fromEntries(phases.map(p => [p.id, p.phase_code]));
        console.log('\n=== PHASE PROGRESS ===');
        progress?.forEach(p => console.log('respondent:', p.respondent_id.slice(0, 8), '| panel:', phaseMap[p.phase_id] || '?', '| status:', p.status));
    }
})();
