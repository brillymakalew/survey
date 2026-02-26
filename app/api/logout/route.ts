import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/logout
 * PRD §9.1 — End local session reference (client-side localStorage cleared by client).
 */
export async function POST() {
    return NextResponse.json({ success: true });
}
