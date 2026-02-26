import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard/funnel
 * PRD §5.8.1 — Response funnel from vw_response_funnel.
 */
export async function GET() {
    try {
        const supabase = createServerClient();
        const { data: funnel } = await supabase
            .from('vw_response_funnel')
            .select('*')
            .single();
        return NextResponse.json({ success: true, funnel: funnel || {} });
    } catch (err) {
        console.error('[/api/admin/dashboard/funnel]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
