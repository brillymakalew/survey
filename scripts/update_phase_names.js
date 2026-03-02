const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let val = match[2] || '';
            val = val.trim().replace(/^['"](.*)['"]$/, '$1');
            if (!process.env[match[1]]) process.env[match[1]] = val;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePhaseNames() {
    console.log("Updating phase names in DB...");
    const updates = [
        { code: 'panel_1', name: 'Panel 1: Ideation' },
        { code: 'panel_2', name: 'Panel 2: Prototyping-Trials' },
        { code: 'panel_3', name: 'Panel 3: Scale-Up' }
    ];

    for (const { code, name } of updates) {
        const { error } = await supabase
            .from('survey_phases')
            .update({ phase_name: name })
            .eq('phase_code', code);

        if (error) {
            console.error(`Error updating ${code}:`, error);
        } else {
            console.log(`Successfully updated ${code} to "${name}"`);
        }
    }
}

updatePhaseNames();
