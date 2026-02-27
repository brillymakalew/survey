import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envStr = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
const envs: Record<string, string> = {};
envStr.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        envs[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = envs['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envs['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching phases...');
    const { data: phases, error: phasesErr } = await supabase.from('survey_phases').select('*');
    if (phasesErr) throw phasesErr;

    const panel3 = phases.find(p => p.phase_code === 'panel_3');
    if (!panel3) throw new Error('panel_3 not found');

    // Insert Panel 3 questions
    const p3Questions = [
        {
            phase_id: panel3.id,
            question_code: 't45_clarity',
            section_code: 't45',
            prompt: 'After Panel 3, my understanding of research translation is clearer',
            help_text: 'Rate from 1 (Strongly Disagree) to 7 (Strongly Agree).',
            question_type: 'likert',
            is_required: true,
            sort_order: 1,
            is_active: true
        },
        {
            phase_id: panel3.id,
            question_code: 't45_challenges',
            section_code: 't45',
            prompt: 'What do you think the Top 2 Biggest challenges?',
            help_text: 'Select exactly 2 items.',
            question_type: 'multi_select',
            options_json: [
                "Finding the right commercial partner",
                "Enhancement of product based on partner/market requirement",
                "Institutional Support",
                "Market Changes",
                "Adoption resistance",
                "Funding",
                "Commercialization pathway (e.g. start up, etc.)",
                "Benefit sharing agreement (e.g. licensing, Royalty, etc.)",
                "Regulatory instability",
                "Other"
            ],
            selection_min: 2,
            selection_max: 2,
            is_required: true,
            sort_order: 2,
            is_active: true
        },
        {
            phase_id: panel3.id,
            question_code: 't45_enablers',
            section_code: 't45',
            prompt: 'What do you think the Top 2 enablers',
            help_text: 'Select exactly 2 items.',
            question_type: 'multi_select',
            options_json: [
                "Partner with aligned goals/vision",
                "Regulatory stability",
                "Clear commercialization pathway",
                "Clear Benefit sharing agreement",
                "Monitoring & reporting transparancy",
                "Institutional Support",
                "Funding",
                "Other"
            ],
            selection_min: 2,
            selection_max: 2,
            is_required: true,
            sort_order: 4,
            is_active: true
        }
    ];

    for (const q of p3Questions) {
        const { error: upsertErr } = await supabase
            .from('survey_questions')
            .upsert(q, { onConflict: 'question_code' });
        if (upsertErr) {
            console.error('Error inserting', q.question_code, upsertErr);
        } else {
            console.log('Upserted', q.question_code);
        }
    }

    // Iterate all questions, find those with "Other" in options, and create an _other text input if not exists
    console.log('Checking for missing "Other" input fields...');
    const { data: allQuestions, error: allQErr } = await supabase.from('survey_questions').select('*').order('sort_order');
    if (allQErr) throw allQErr;

    for (const q of allQuestions) {
        if (q.options_json && Array.isArray(q.options_json)) {
            if (q.options_json.includes('Other') || q.options_json.includes('Others')) {
                const optionTrigger = q.options_json.includes('Other') ? 'Other' : 'Others';
                const otherCode = `${q.question_code}_other`;
                const exists = allQuestions.find(existing => existing.question_code === otherCode);

                if (!exists) {
                    console.log(`Missing "Other" text field for ${q.question_code}. Creating ${otherCode}...`);

                    const newOtherQ = {
                        phase_id: q.phase_id,
                        question_code: otherCode,
                        section_code: q.section_code,
                        prompt: `Please specify your "Other" answer for: ${q.prompt}`,
                        question_type: 'short_text',
                        is_required: false,
                        conditional_logic_json: {
                            show_if: {
                                question_code: q.question_code,
                                answer_in: [optionTrigger]
                            }
                        },
                        sort_order: q.sort_order + 1, // Just place it right after
                        is_active: true
                    };

                    const { error: insErr } = await supabase.from('survey_questions').insert(newOtherQ);
                    if (insErr) {
                        console.error('Failed to create', otherCode, insErr);
                    } else {
                        console.log('Created', otherCode);
                    }
                }
            }
        }
    }

    console.log('Done.');
}

run().catch(console.error);
