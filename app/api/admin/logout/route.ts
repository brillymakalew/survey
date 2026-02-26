import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/logout
 * PRD §9.2 — Clear admin session cookie.
 */
export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
    });
    return response;
}
