'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Invalid password.');
                setLoading(false); return;
            }
            router.push('/admin/dashboard');
        } catch {
            setError('Network error. Please try again.');
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-500/20 border border-blue-400/20 mb-4">
                        <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                    <p className="text-white/40 text-sm mt-1">Enter your password to continue</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-7">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-white/60 text-sm mb-1.5" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/50 transition-all"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-2.5 text-red-300 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold
                py-3 rounded-xl transition-all duration-200"
                        >
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
