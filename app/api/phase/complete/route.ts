import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { logEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/phase/complete
 * PRD §9.1, §5.6 — Mark a phase completed, unlock next phase.
 */
export async function POST(request: NextRequest) {
    try {
        const sessionToken = request.headers.get('x-session-token');
        if (!sessionToken) {
            return NextResponse.json({ error: 'Session token required.' }, { status: 401 });
        }

        const { phase_code } = await request.json();
        if (!phase_code) {
            return NextResponse.json({ error: 'phase_code is required.' }, { status: 400 });
        }

        const supabase = createServerClient();

        // Validate session
        const { data: session } = await supabase
            .from('response_sessions')
            .select('id, respondent_id, status')
            .eq('session_token', sessionToken)
            .single();

        if (!session || session.status !== 'active') {
            return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
        }

        const { respondent_id: respondentId, id: sessionId } = session;

        // Get phase being completed
        const { data: phase } = await supabase
            .from('survey_phases')
            .select('id, sort_order, phase_code')
            .eq('phase_code', phase_code)
            .single();

        if (!phase) {
            return NextResponse.json({ error: 'Phase not found.' }, { status: 404 });
        }

        // Mark phase as completed
        await supabase.from('phase_progress').upsert(
            {
                respondent_id: respondentId,
                phase_id: phase.id,
                status: 'completed',
                completed_at: new Date().toISOString(),
                completion_percent: 100,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'respondent_id,phase_id' }
        );

        // Finalize responses for this phase
        await supabase
            .from('survey_responses')
            .update({ is_finalized: true })
            .eq('respondent_id', respondentId)
            .eq('phase_id', phase.id);

        // Determine next phase
        const { data: nextPhase } = await supabase
            .from('survey_phases')
            .select('id, phase_code')
            .eq('is_active', true)
            .gt('sort_order', phase.sort_order)
            .order('sort_order')
            .limit(1)
            .single();

        const newCurrentPhase = nextPhase?.phase_code ?? 'completed';

        // Update respondent current_phase
        await supabase
            .from('respondents')
            .update({ current_phase: newCurrentPhase, updated_at: new Date().toISOString() })
            .eq('id', respondentId);

        if (!nextPhase) {
            // All phases done — close session
            await supabase
                .from('response_sessions')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sessionId);
        } else {
            // Pre-create next phase progress record (not_started)
            await supabase.from('phase_progress').upsert(
                {
                    respondent_id: respondentId,
                    phase_id: nextPhase.id,
                    status: 'not_started',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'respondent_id,phase_id', ignoreDuplicates: true }
            );
        }

        await logEvent('respondent', respondentId, 'phase_completed', 'phase_progress', phase.id, { phase_code });

        return NextResponse.json({
            success: true,
            phase_completed: phase_code,
            next_phase: nextPhase?.phase_code ?? 'done',
        });
    } catch (err) {
        console.error('[/api/phase/complete]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
