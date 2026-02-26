import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/responses/save
 * PRD §9.1, §5.4.3 — Batch upsert answers; update session + phase progress.
 */
export async function POST(request: NextRequest) {
    try {
        const sessionToken = request.headers.get('x-session-token');
        if (!sessionToken) {
            return NextResponse.json({ error: 'Session token required.' }, { status: 401 });
        }

        const body = await request.json();
        const { answers, phase_code, step_code } = body;

        if (!Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json({ error: 'answers array is required.' }, { status: 400 });
        }

        const supabase = createServerClient();

        // Validate session
        const { data: session } = await supabase
            .from('response_sessions')
            .select('id, respondent_id, status')
            .eq('session_token', sessionToken)
            .single();

        if (!session || session.status !== 'active') {
            return NextResponse.json({ error: 'Invalid or inactive session.' }, { status: 401 });
        }

        const { respondent_id: respondentId, id: sessionId } = session;

        // Resolve phase_id
        let phaseId: string | null = null;
        if (phase_code) {
            const { data: phase } = await supabase
                .from('survey_phases')
                .select('id')
                .eq('phase_code', phase_code)
                .single();
            phaseId = phase?.id ?? null;
        }

        // Upsert each answer (unique: respondent_id + question_id)
        const rows = (answers as { question_id: string; answer_value_json: unknown; answer_text?: string }[]).map(a => ({
            respondent_id: respondentId,
            session_id: sessionId,
            phase_id: phaseId,
            question_id: a.question_id,
            answer_value_json: a.answer_value_json,
            answer_text: a.answer_text ?? null,
            answered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        const { error: upsertError } = await supabase
            .from('survey_responses')
            .upsert(rows, { onConflict: 'respondent_id,question_id' });

        if (upsertError) {
            console.error('[save] upsert error', upsertError);
            return NextResponse.json({ error: 'Failed to save answers.' }, { status: 500 });
        }

        // Update session activity
        await supabase
            .from('response_sessions')
            .update({
                last_activity_at: new Date().toISOString(),
                last_phase: phase_code ?? null,
                last_step_code: step_code ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId);

        // Update phase progress (upsert to in_progress)
        if (phaseId) {
            await supabase.from('phase_progress').upsert(
                {
                    respondent_id: respondentId,
                    phase_id: phaseId,
                    status: 'in_progress',
                    last_step_code: step_code ?? null,
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'respondent_id,phase_id', ignoreDuplicates: false }
            );
        }

        return NextResponse.json({
            success: true,
            saved_count: rows.length,
            last_saved_at: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[/api/responses/save]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
