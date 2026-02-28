import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data: phases } = await supabase.from('survey_phases').select('*');
    console.log('Phases:', phases);

    const { data: funnel, error } = await supabase.from('vw_response_funnel').select('*');
    console.log('Funnel:', funnel, error);
}

main().catch(console.error);
