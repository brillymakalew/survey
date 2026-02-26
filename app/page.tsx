'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Landing Page — PRD §5.3, §6.1, §12
 * Name + Phone form → POST /api/respondent/start → redirect to survey
 */
export default function Home() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resumeChecking, setResumeChecking] = useState(true);

    // ── Auto-resume existing session ─────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('respondent_session_token');
        if (!token) { setResumeChecking(false); return; }

        fetch('/api/respondent/resume', {
            headers: { 'x-session-token': token },
        })
            .then(r => r.json())
            .then(data => {
                if (!data.success) { setResumeChecking(false); return; }

                // Find resume point (same logic as /api/respondent/start)
                const sortedPhases = [...(data.phases || [])].sort(
                    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
                );
                let resumePhase = 'panel_1';
                const allCompleted = sortedPhases.length > 0 && sortedPhases.every(
                    (p: { progress?: { status: string } }) => p.progress?.status === 'completed'
                );
                if (allCompleted) {
                    router.replace('/survey/done');
                    return;
                }
                for (const p of sortedPhases as Array<{ phase_code: string; progress?: { status: string } }>) {
                    if (!p.progress || p.progress.status === 'not_started') {
                        resumePhase = p.phase_code; break;
                    }
                    if (p.progress.status === 'in_progress') {
                        resumePhase = p.phase_code; break;
                    }
                }
                router.replace(`/survey/panel/${resumePhase}`);
            })
            .catch(() => setResumeChecking(false));
        // runs once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Show spinner while checking for an existing session
    if (resumeChecking) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center">
                <svg className="animate-spin w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
            </main>
        );
    }


    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/respondent/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName, phone }),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || 'Something went wrong. Please try again.');
                setLoading(false);
                return;
            }

            // Store session token for subsequent calls
            if (typeof window !== 'undefined') {
                localStorage.setItem('respondent_session_token', data.session_token);
                localStorage.setItem('respondent_id', data.respondent_id);
            }

            // Navigate to resume point
            if (data.resume_phase === 'done') {
                router.push('/survey/done');
            } else {
                router.push(`/survey/panel/${data.resume_phase}`);
            }
        } catch {
            setError('Network error. Please check your connection and try again.');
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/30 mb-4">
                        <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">UK–Indonesia Research Forum</h1>
                    <p className="text-blue-200/60 text-sm leading-relaxed">
                        Multi-panel questionnaire on research translation pathways.
                    </p>
                </div>

                {/* Form */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <h2 className="text-white font-semibold text-lg mb-6">Let&apos;s Get Started</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-white/70 text-sm mb-1.5" htmlFor="full_name">
                                Full Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="full_name"
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                placeholder="e.g. Arnanda Surya"
                                autoComplete="name"
                                required
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30
                  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-white/70 text-sm mb-1.5" htmlFor="phone">
                                WhatsApp / Mobile Number <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="e.g. 0812 3456 7890"
                                autoComplete="tel"
                                required
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30
                  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/50 transition-all"
                            />
                            <p className="text-white/30 text-xs mt-1.5">
                                Used to save and resume your progress. Indonesian numbers (62xxx / 08xxx) accepted.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white
                font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Preparing…
                                </>
                            ) : (
                                'Start Questionnaire →'
                            )}
                        </button>
                    </form>

                    {/* Privacy notice — PRD §12 */}
                    <p className="text-white/25 text-xs mt-6 leading-relaxed text-center">
                        Your name and phone number are used only for survey progress tracking and follow-up matchmaking.
                        By continuing you consent to this use. Data is stored securely and not shared with third parties.
                    </p>
                </div>
            </div>
        </main>
    );
}
