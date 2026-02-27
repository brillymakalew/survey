import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard/questions?phase=<phase_code>
 * PRD §5.8.3 — Per-question analytics: option counts + likert summaries.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const phaseCode = searchParams.get('phase') || 'phase_1';

        const affiliation = searchParams.get('affiliation') || '';
        const country = searchParams.get('country') || '';

        const supabase = createServerClient();

        // 1. Fetch affiliation/country data for all respondents
        const { data: attrResponses } = await supabase
            .from('survey_responses')
            .select(`respondent_id, answer_value_json, survey_questions!inner(question_code)`)
            .in('survey_questions.question_code', [
                'affiliation_type', 'closing_affiliation_type', 't23_affiliation_type',
                'country_base', 'closing_country_base', 't23_country_base'
            ]);

        const respondentsMap = new Map<string, { affiliation: string; country_base: string }>();
        attrResponses?.forEach(r => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sq: any = r.survey_questions;
            const code = sq.question_code;
            const val = r.answer_value_json as string;
            const id = r.respondent_id;

            if (!respondentsMap.has(id)) {
                respondentsMap.set(id, { affiliation: 'Unknown', country_base: 'Unknown' });
            }
            const mapObj = respondentsMap.get(id)!;
            if (code.includes('affiliation')) mapObj.affiliation = val;
            else if (code.includes('country')) mapObj.country_base = val;
        });

        // 2. Fetch raw responses for the requested phase
        const { data: rawResponses } = await supabase
            .from('survey_responses')
            .select(`
                respondent_id, answer_value_json,
                survey_questions!inner(question_code, prompt, question_type),
                survey_phases!inner(phase_code)
            `)
            .eq('survey_phases.phase_code', phaseCode);

        // 3. Filter responses based on affiliation and country criteria
        const filtered = (rawResponses || []).filter(r => {
            const attrs = respondentsMap.get(r.respondent_id) || { affiliation: 'Unknown', country_base: 'Unknown' };
            if (affiliation && attrs.affiliation !== affiliation) return false;
            if (country && attrs.country_base !== country) return false;
            return true;
        });

        // 4. Aggregate option counts & likert summaries in memory
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const optionCounts: any[] = [];
        const likertMap: Record<string, { sum: number; count: number; min: number; max: number; prompt: string }> = {};
        const optionMap: Record<string, Record<string, number>> = {};
        const promptMap: Record<string, string> = {};
        const typeMap: Record<string, string> = {};

        for (const r of filtered) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { question_code, prompt, question_type } = r.survey_questions as any;
            let val = r.answer_value_json;
            // Unpack object structure like {"question_code": "value"} if it exists
            if (val && typeof val === 'object' && !Array.isArray(val) && val[question_code] !== undefined) {
                val = val[question_code];
            }

            promptMap[question_code] = prompt;
            typeMap[question_code] = question_type;

            if (question_type === 'single_choice' || question_type === 'multi_select') {
                if (!optionMap[question_code]) optionMap[question_code] = {};
                const arr = Array.isArray(val) ? val : [val];
                for (const v of arr) {
                    if (v !== null && v !== undefined && v !== '') {
                        const sval = String(v);
                        optionMap[question_code][sval] = (optionMap[question_code][sval] || 0) + 1;
                    }
                }
            } else if (question_type === 'likert') {
                const num = Number(val);
                if (!isNaN(num) && val !== null) {
                    if (!likertMap[question_code]) {
                        likertMap[question_code] = { sum: 0, count: 0, min: num, max: num, prompt };
                    }
                    const lm = likertMap[question_code];
                    lm.sum += num;
                    lm.count++;
                    if (num < lm.min) lm.min = num;
                    if (num > lm.max) lm.max = num;
                }
            }
        }

        for (const [code, opts] of Object.entries(optionMap)) {
            for (const [opt, count] of Object.entries(opts)) {
                optionCounts.push({
                    question_code: code,
                    prompt: promptMap[code],
                    question_type: typeMap[code],
                    opt_value: opt,
                    selection_count: count,
                });
            }
        }
        optionCounts.sort((a, b) => {
            if (a.question_code !== b.question_code) return a.question_code.localeCompare(b.question_code);
            return b.selection_count - a.selection_count;
        });

        const likertSummary = Object.entries(likertMap).map(([code, lm]) => ({
            question_code: code,
            prompt: lm.prompt,
            avg_score: lm.count > 0 ? Number((lm.sum / lm.count).toFixed(2)) : 0,
            response_count: lm.count,
            min_score: lm.min,
            max_score: lm.max,
        }));

        return NextResponse.json({
            success: true,
            option_counts: optionCounts,
            likert_summary: likertSummary,
        });
    } catch (err) {
        console.error('[/api/admin/dashboard/questions]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
