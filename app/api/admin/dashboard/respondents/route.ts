import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard/respondents
 * PRD §5.8.3, §6.2 — Paginated respondent list with search and filters.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const pageSize = Math.min(100, parseInt(searchParams.get('page_size') || '20', 10));
        const search = searchParams.get('search') || '';
        const phase = searchParams.get('phase') || '';
        const startDate = searchParams.get('start_date') || '';
        const endDate = searchParams.get('end_date') || '';

        const supabase = createServerClient();
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('respondents')
            .select('id, full_name, phone_normalized, current_phase, status, created_at, last_seen_at', { count: 'exact' });

        if (search) query = query.ilike('full_name', `%${search}%`);
        if (phase) query = query.eq('current_phase', phase);
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        const { data: respondents, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            respondents: respondents || [],
            total: count || 0,
            page,
            page_size: pageSize,
            total_pages: Math.ceil((count || 0) / pageSize),
        });
    } catch (err) {
        console.error('[/api/admin/dashboard/respondents]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
