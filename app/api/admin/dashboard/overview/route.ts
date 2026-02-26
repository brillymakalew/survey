import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard/overview
 * PRD §5.8.1 — Overview metrics, funnel, phase stats, affiliation/intent breakdown.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(request.url);

        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        // Funnel from view
        const { data: funnel } = await supabase
            .from('vw_response_funnel')
            .select('*')
            .single();

        // Phase completion stats
        const { data: phaseStats } = await supabase
            .from('vw_phase_completion_stats')
            .select('*');

        // Affiliation × country breakdown
        const { data: affiliationData } = await supabase
            .from('vw_affiliation_country_breakdown')
            .select('*');

        // Collaboration intent summary
        const { data: intentData } = await supabase
            .from('vw_collaboration_intent_summary')
            .select('*');

        // Total respondents + recent list (with optional date filter)
        const { count: totalRespondents } = await supabase
            .from('respondents')
            .select('*', { count: 'exact', head: true });

        let recentQuery = supabase
            .from('respondents')
            .select('id, full_name, current_phase, status, created_at, last_seen_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (startDate) recentQuery = recentQuery.gte('created_at', startDate);
        if (endDate) recentQuery = recentQuery.lte('created_at', endDate);

        const { data: recentRespondents } = await recentQuery;

        return NextResponse.json({
            success: true,
            overview: {
                total_respondents: totalRespondents || 0,
                funnel: funnel || {},
                phase_stats: phaseStats || [],
                affiliation_breakdown: affiliationData || [],
                collaboration_intent: intentData || [],
                recent_respondents: recentRespondents || [],
            },
        });
    } catch (err) {
        console.error('[/api/admin/dashboard/overview]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
