import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: phases } = await supabase.from('survey_phases').select('*').order('sort_order');
    console.log('PHASES:');
    console.table(phases);
}
check();
