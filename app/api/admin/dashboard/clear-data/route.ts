import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/dashboard/clear-data
 * Clears ALL respondent and survey data from the database.
 * Protected by Admin Authentication session.
 */
export async function POST(request: NextRequest) {
    try {
        // Step 1: Admin Authorization
        const adminSession = request.cookies.get('admin_session')?.value;
        if (!adminSession) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServerClient();
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', adminSession)
            .single();

        if (!adminUser) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Step 2: Ensure it's a POST with a valid intent payload
        const body = await request.json();
        if (body.intent !== 'saya setuju') {
            return NextResponse.json({ success: false, error: 'Invalid confirmation string' }, { status: 400 });
        }

        // Step 3: Execute safe but total wipe (Supabase requires filtering for delete)
        // Since id is a UUID, we can safely delete everything that isn't a fake static UUID.
        // Because of the 'on delete cascade' schema, this handles sessions, answers, and progress rows.
        const { error: deletionError } = await supabase
            .from('respondents')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deletionError) {
            console.error('[clear-data] delete fail:', deletionError);
            return NextResponse.json({ success: false, error: 'Failed to delete records.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'All survey data has been permanently cleared.' });
    } catch (err) {
        console.error('[/api/admin/dashboard/clear-data]', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
