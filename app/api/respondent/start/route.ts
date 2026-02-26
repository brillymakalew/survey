import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { validatePhone } from '@/lib/phone';
import { logEvent } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/respondent/start
 * PRD §9.1, §10.1 — Create or resume a respondent by name + phone.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { full_name, phone } = body;

        // Validate inputs
        if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
            return NextResponse.json({ error: 'Full name is required (minimum 2 characters).' }, { status: 400 });
        }
        const phoneValidation = validatePhone(phone);
        if (!phoneValidation.valid) {
            return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
        }

        const phone_normalized = phoneValidation.normalized;
        const supabase = createServerClient();

        // Look up existing respondent by normalized phone (PRD §5.2.4)
        const { data: existing } = await supabase
            .from('respondents')
            .select('*')
            .eq('phone_normalized', phone_normalized)
            .single();

        let respondentId: string;
        let sessionToken: string;
        let isNew = false;

        if (existing) {
            // ── RETURNING RESPONDENT ──────────────────────────────────
            respondentId = existing.id;

            // Update last seen & name (keep latest non-empty input per PRD §10.1)
            await supabase
                .from('respondents')
                .update({
                    full_name: full_name.trim(),
                    last_seen_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', respondentId);

            // Find or create active session
            const { data: activeSession } = await supabase
                .from('response_sessions')
                .select('*')
                .eq('respondent_id', respondentId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (activeSession) {
                sessionToken = activeSession.session_token;
                await supabase
                    .from('response_sessions')
                    .update({ last_activity_at: new Date().toISOString() })
                    .eq('id', activeSession.id);
            } else {
                sessionToken = uuidv4();
                await supabase.from('response_sessions').insert({
                    respondent_id: respondentId,
                    session_token: sessionToken,
                    status: 'active',
                    resume_key_version: 2,
                });
            }
            await logEvent('respondent', respondentId, 'resumed_session', 'respondent', respondentId, { phone_normalized });

        } else {
            // ── NEW RESPONDENT ────────────────────────────────────────
            isNew = true;
            sessionToken = uuidv4();

            const { data: newRespondent, error: createError } = await supabase
                .from('respondents')
                .insert({
                    full_name: full_name.trim(),
                    phone_raw: phone,
                    phone_normalized,
                    current_phase: 'panel_1',
                    status: 'active',
                    last_seen_at: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (createError || !newRespondent) {
                console.error('[start] create error', createError);
                return NextResponse.json({ error: 'Failed to create respondent record.' }, { status: 500 });
            }

            respondentId = newRespondent.id;

            await supabase.from('response_sessions').insert({
                respondent_id: respondentId,
                session_token: sessionToken,
                status: 'active',
                resume_key_version: 1,
            });

            await logEvent('respondent', respondentId, 'created', 'respondent', respondentId);
        }

        // ── DETERMINE RESUME POINT (PRD §10.2) ───────────────────
        const { data: progressRows } = await supabase
            .from('phase_progress')
            .select('phase_id, status, last_step_code')
            .eq('respondent_id', respondentId);

        const { data: phases } = await supabase
            .from('survey_phases')
            .select('id, phase_code, sort_order')
            .eq('is_active', true)
            .order('sort_order');

        let resumePhase = 'panel_1';
        let resumeStep: string | null = null;

        if (phases && progressRows) {
            const progressMap = Object.fromEntries(progressRows.map(p => [p.phase_id, p]));
            for (const phase of phases) {
                const progress = progressMap[phase.id];
                if (!progress || progress.status === 'not_started') {
                    resumePhase = phase.phase_code;
                    break;
                }
                if (progress.status === 'in_progress') {
                    resumePhase = phase.phase_code;
                    resumeStep = progress.last_step_code ?? null;
                    break;
                }
                // completed → continue to next phase
            }
            // All phases completed
            const allCompleted = phases.every(ph => {
                const prog = progressMap[ph.id];
                return prog && prog.status === 'completed';
            });
            if (allCompleted) resumePhase = 'done';
        }

        return NextResponse.json({
            success: true,
            is_new: isNew,
            respondent_id: respondentId,
            session_token: sessionToken,
            resume_phase: resumePhase,
            resume_step: resumeStep,
        });
    } catch (err) {
        console.error('[/api/respondent/start]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
