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

        return NextResponse.json({ questions: questions || [] });
    } catch (err) {
        console.error('[/api/survey/questions]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
