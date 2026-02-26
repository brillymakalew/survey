import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(
    process.env.ADMIN_SESSION_SECRET || 'fallback-secret-change-in-production-32c'
);

/**
 * Middleware — protects /admin/dashboard and /api/admin/* routes with JWT.
 * PRD §5.7, §11
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isAdminDashboard = pathname.startsWith('/admin/dashboard');
    const isAdminApi = pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/login');

    if (isAdminDashboard || isAdminApi) {
        const sessionCookie = request.cookies.get('admin_session')?.value;

        if (!sessionCookie) {
            if (isAdminApi) {
                return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        try {
            await jwtVerify(sessionCookie, SESSION_SECRET);
            return NextResponse.next();
        } catch {
            // Token invalid or expired
            const response = isAdminApi
                ? NextResponse.json({ error: 'Session expired.' }, { status: 401 })
                : NextResponse.redirect(new URL('/admin/login', request.url));
            response.cookies.delete('admin_session');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/dashboard/:path*', '/api/admin/:path*'],
};
