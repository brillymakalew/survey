import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/survey/questions?phase=<phase_code>
 * Returns all active questions for a given phase.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const phaseCode = searchParams.get('phase');
        const sessionToken = request.headers.get('x-session-token');

        if (!phaseCode) {
            return NextResponse.json({ error: 'phase query param is required.' }, { status: 400 });
        }

        const supabase = createServerClient();

        const { data: phase } = await supabase
            .from('survey_phases')
            .select('id')
            .eq('phase_code', phaseCode)
            .single();

        if (!phase) {
            return NextResponse.json({ questions: [] });
        }

        const { data: questions, error } = await supabase
            .from('survey_questions')
            .select('*')
            .eq('phase_id', phase.id)
            .eq('is_active', true)
            .order('sort_order');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let finalQuestions = questions || [];

        if (sessionToken && phaseCode !== 'panel_1') {
            const { data: session } = await supabase
                .from('response_sessions')
                .select('respondent_id')
                .eq('session_token', sessionToken)
                .single();

            if (session) {
                const { data: existingAnswers } = await supabase
                    .from('survey_responses')
                    .select('question_id, survey_questions!inner(question_code)')
                    .eq('respondent_id', session.respondent_id)
                    .in('survey_questions.question_code', ['affiliation_type', 'country_base']);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const answeredCodes = existingAnswers?.map((r: any) =>
                    Array.isArray(r.survey_questions) ? r.survey_questions[0].question_code : r.survey_questions.question_code
                ) || [];
                const missAffiliation = !answeredCodes.includes('affiliation_type');
                const missCountry = !answeredCodes.includes('country_base');

                if (missAffiliation || missCountry) {
                    const codesToFetch = [];
                    if (missAffiliation) codesToFetch.push('affiliation_type', 'affiliation_type_other');
                    if (missCountry) codesToFetch.push('country_base', 'country_base_other');

                    const { data: extraQs } = await supabase
                        .from('survey_questions')
                        .select('*')
                        .in('question_code', codesToFetch)
                        .eq('is_active', true)
                        .order('sort_order');

                    if (extraQs && extraQs.length > 0) {
                        finalQuestions = [...extraQs, ...finalQuestions];
                    }
                }
            }
        }

        return NextResponse.json({ questions: finalQuestions });
    } catch (err) {
        console.error('[/api/survey/questions]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
