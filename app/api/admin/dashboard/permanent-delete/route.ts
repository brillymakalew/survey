import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/dashboard/permanent-delete
 * Permanently deletes ALL soft-deleted survey data.
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

        // Permanently delete soft-deleted respondents
        const { error: deletionError } = await supabase
            .from('respondents')
            .delete()
            .eq('status', 'deleted');

        if (deletionError) {
            console.error('[permanent-delete] delete fail:', deletionError);
            return NextResponse.json({ success: false, error: 'Failed to permanently delete records.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'All deleted survey data has been permanently removed.' });
    } catch (err) {
        console.error('[/api/admin/dashboard/permanent-delete]', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
