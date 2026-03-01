import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/dashboard/restore-data
 * Restores ALL soft-deleted survey data.
 * Protected by Admin Authentication session.
 */
export async function POST(request: NextRequest) {
    try {
        const adminSession = request.cookies.get('admin_session')?.value;
        if (!adminSession) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        if (body.intent !== 'saya setuju') {
            return NextResponse.json({ success: false, error: 'Invalid confirmation string' }, { status: 400 });
        }

        const supabase = createServerClient();

        // Restore soft-deleted respondents
        const { error: deletionError } = await supabase
            .from('respondents')
            .update({ status: 'active' })
            .eq('status', 'deleted');

        if (deletionError) {
            console.error('[restore-data] restore fail:', deletionError);
            return NextResponse.json({ success: false, error: 'Failed to restore records.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'All previously deleted survey data has been restored.' });
    } catch (err) {
        console.error('[/api/admin/dashboard/restore-data]', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
