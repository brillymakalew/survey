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

        const supabase = createServerClient();

        const { data: optionCounts } = await supabase
            .from('vw_question_option_counts')
            .select('*')
            .eq('phase_code', phaseCode);

        const { data: likertSummary } = await supabase
            .from('vw_likert_summary')
            .select('*')
            .eq('phase_code', phaseCode);

        return NextResponse.json({
            success: true,
            option_counts: optionCounts || [],
            likert_summary: likertSummary || [],
        });
    } catch (err) {
        console.error('[/api/admin/dashboard/questions]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
