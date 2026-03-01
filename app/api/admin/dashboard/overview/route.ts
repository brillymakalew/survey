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

        // Instead of the broken view, compute funnel in memory
        // Only count active respondents for total
        const { count: totalRespondents } = await supabase
            .from('respondents')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'deleted');

        // Fetch active respondent IDs
        const { data: activeRespondents } = await supabase
            .from('respondents')
            .select('id')
            .neq('status', 'deleted');
        const activeRespondentIds = new Set((activeRespondents || []).map(r => r.id));

        const { data: allPhases } = await supabase.from('survey_phases').select('id, phase_code');
        const { data: allProgress } = await supabase.from('phase_progress').select('phase_id, status, respondent_id');

        const phaseIdMap = (allPhases || []).reduce((acc, p) => ({ ...acc, [p.phase_code]: p.id }), {} as Record<string, string>);

        const countProgress = (phaseCode: string, statuses: string[]) => {
            const phaseId = phaseIdMap[phaseCode];
            if (!phaseId || !allProgress) return 0;
            return allProgress.filter(p => p.phase_id === phaseId && statuses.includes(p.status) && activeRespondentIds.has(p.respondent_id)).length;
        };

        const funnel = {
            total_respondents: totalRespondents || 0,
            phase1_started: countProgress('panel_1', ['in_progress', 'completed']),
            phase1_completed: countProgress('panel_1', ['completed']),
            phase2_completed: countProgress('panel_2', ['completed']),
            phase3_completed: countProgress('panel_3', ['completed']),
            closing_completed: countProgress('closing', ['completed']),
        };

        // Phase completion stats (now filtered by SQL view)
        const { data: phaseStats } = await supabase
            .from('vw_phase_completion_stats')
            .select('*');

        // Dynamically compute affiliation and collaboration instead of using broken views
        const { data: qAffiliation } = await supabase.from('survey_questions').select('id, question_code').in('question_code', ['affiliation_type', 'country_base']);
        const { data: qIntent } = await supabase.from('survey_questions').select('id, question_code').eq('question_code', 'collaboration_intent');

        const affilMap = (qAffiliation || []).reduce((acc, q) => ({ ...acc, [q.question_code]: q.id }), {} as Record<string, string>);
        const intentId = qIntent?.[0]?.id;

        const { data: responses } = await supabase.from('survey_responses')
            .select('respondent_id, question_id, answer_value_json');

        const respData = new Map<string, { affiliation?: string, country_base?: string, intent?: string }>();

        responses?.filter(r => activeRespondentIds.has(r.respondent_id)).forEach(r => {
            const rid = r.respondent_id;
            if (!respData.has(rid)) respData.set(rid, {});
            const item = respData.get(rid)!;

            const ans = String(r.answer_value_json).replace(/^"|"$/g, ''); // Unquote if needed

            if (r.question_id === affilMap['affiliation_type']) item.affiliation = ans || 'Unknown';
            if (r.question_id === affilMap['country_base']) item.country_base = ans || 'Unknown';
            if (r.question_id === intentId) item.intent = ans || 'Unknown';
        });

        // 1. Agg Affiliation Breakdown
        const affilCount = new Map<string, number>();
        Array.from(respData.values()).forEach(d => {
            if (d.affiliation || d.country_base) {
                const key = `${d.affiliation || 'Unknown'}|${d.country_base || 'Unknown'}`;
                affilCount.set(key, (affilCount.get(key) || 0) + 1);
            }
        });
        const affiliationData = Array.from(affilCount.entries()).map(([k, count]) => {
            const [affiliation, country_base] = k.split('|');
            return { affiliation, country_base, respondent_count: count };
        });

        // 2. Agg Collaboration Intent
        const intentCount = new Map<string, number>();
        let totalIntents = 0;
        Array.from(respData.values()).forEach(d => {
            if (d.intent) {
                intentCount.set(d.intent, (intentCount.get(d.intent) || 0) + 1);
                totalIntents++;
            }
        });
        const intentData = Array.from(intentCount.entries()).map(([intent, count]) => ({
            intent, respondent_count: count, pct: totalIntents > 0 ? (count / totalIntents) * 100 : 0
        }));

        let recentQuery = supabase
            .from('respondents')
            .select('id, full_name, current_phase, status, created_at, last_seen_at')
            .neq('status', 'deleted')
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
