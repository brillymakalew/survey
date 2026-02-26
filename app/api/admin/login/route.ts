import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServerClient } from '@/lib/supabase';
import { logEvent } from '@/lib/audit';
import { SignJWT } from 'jose';

export const dynamic = 'force-dynamic';

const SESSION_SECRET = new TextEncoder().encode(
    process.env.ADMIN_SESSION_SECRET || 'fallback-secret-change-in-production-32c'
);

/**
 * POST /api/admin/login
 * PRD §9.2, §5.7 — bcrypt password verification, 8h JWT session cookie.
 */
export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();
        if (!password) {
            return NextResponse.json({ error: 'Password required.' }, { status: 400 });
        }

        let authenticated = false;

        // Strategy 1: env var hash (preferred for MVP)
        const envHash = process.env.ADMIN_PASSWORD_HASH;
        if (envHash) {
            authenticated = await bcrypt.compare(password, envHash);
        } else {
            // Strategy 2: database lookup
            const supabase = createServerClient();
            const { data: adminUser } = await supabase
                .from('admin_users')
                .select('password_hash')
                .eq('username', 'admin')
                .eq('is_active', true)
                .single();
            if (adminUser) {
                authenticated = await bcrypt.compare(password, adminUser.password_hash);
            }
        }

        if (!authenticated) {
            await logEvent('admin', null, 'login_failed', 'admin_users', null, {});
            return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
        }

        // Issue JWT — expires in 8h per PRD §5.7.2
        const token = await new SignJWT({ role: 'admin' })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('8h')
            .setIssuedAt()
            .sign(SESSION_SECRET);

        await logEvent('admin', 'admin', 'login_success', 'admin_users', null, {});

        const response = NextResponse.json({ success: true });
        response.cookies.set('admin_session', token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 8 * 60 * 60,
            path: '/',
            secure: process.env.NODE_ENV === 'production',
        });
        return response;
    } catch (err) {
        console.error('[/api/admin/login]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
