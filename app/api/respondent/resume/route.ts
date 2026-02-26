import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/respondent/resume
 * PRD §9.1 — Fetch current respondent progress and all saved answers.
 */
export async function GET(request: NextRequest) {
    try {
        const sessionToken =
            request.headers.get('x-session-token') ||
            request.nextUrl.searchParams.get('token');

        if (!sessionToken) {
            return NextResponse.json({ error: 'Session token required.' }, { status: 401 });
        }

        const supabase = createServerClient();

        // Fetch session + respondent
        const { data: session, error: sessionError } = await supabase
            .from('response_sessions')
            .select('*, respondent:respondents(*)')
            .eq('session_token', sessionToken)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Session not found or expired.' }, { status: 404 });
        }

        const respondentId = session.respondent_id;

        // Fetch phase progress
        const { data: progressRows } = await supabase
            .from('phase_progress')
            .select('phase_id, status, last_step_code, completion_percent, started_at, completed_at')
            .eq('respondent_id', respondentId);

        // Fetch all active phases
        const { data: phases } = await supabase
            .from('survey_phases')
            .select('id, phase_code, phase_name, sort_order')
            .eq('is_active', true)
            .order('sort_order');

        // Fetch all saved responses for this respondent
        const { data: responses } = await supabase
            .from('survey_responses')
            .select('question_id, answer_value_json, answered_at')
            .eq('respondent_id', respondentId);

        const progressMap = Object.fromEntries(
            (progressRows || []).map(p => [p.phase_id, p])
        );

        return NextResponse.json({
            success: true,
            respondent: session.respondent,
            session: {
                id: session.id,
                token: session.session_token,
                status: session.status,
                last_phase: session.last_phase,
                last_step_code: session.last_step_code,
            },
            phases: (phases || []).map(ph => ({
                ...ph,
                progress: progressMap[ph.id] || { status: 'not_started', completion_percent: 0 },
            })),
            // Map question_id → answer for easy client-side restore
            saved_responses: Object.fromEntries(
                (responses || []).map(r => [r.question_id, r.answer_value_json])
            ),
        });
    } catch (err) {
        console.error('[/api/respondent/resume]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
