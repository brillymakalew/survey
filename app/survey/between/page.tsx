'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const PANEL_LABELS: Record<string, string> = {
    panel_1: 'Panel 1: Ideation (T0-T1)',
    panel_2: 'Panel 2: Prototyping-Trials (T2-T3)',
    panel_3: 'Panel 3: Scale-Up (T4-T5)',
};

function BetweenContent() {
    const searchParams = useSearchParams();
    const completedPhase = searchParams.get('from') || 'panel_1';
    const panelLabel = PANEL_LABELS[completedPhase] || completedPhase;

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
            <div className="max-w-lg w-full text-center">

                {/* Checkmark icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border border-green-400/30 mb-6">
                    <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold text-white mb-3">Thank You!</h1>
                <p className="text-blue-300/70 text-sm font-medium mb-4">{panelLabel} completed</p>

                <p className="text-white/60 text-base leading-relaxed mb-10">
                    Your answers have been saved. The next session will be accessed through a
                    separate link shared by the organizers.
                </p>

                {/* QR / next session info card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-7 text-left space-y-5 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-white font-semibold mb-1">Scan the QR code for the next session</h2>
                            <p className="text-white/50 text-sm leading-relaxed">
                                The QR code for the next panel will be displayed by the organizers at the end of the current session.
                                Use the same WhatsApp number so your progress is retained automatically.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-white font-semibold mb-1">Your progress is saved</h2>
                            <p className="text-white/50 text-sm leading-relaxed">
                                Your responses from this panel are locked in. When you open the next panel&apos;s link,
                                you will continue from where you left off — no need to re-enter your details.
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-white/20 text-xs">
                    You may safely close this page. Your progress will be waiting when you open the next link.
                </p>
            </div>
        </main>
    );
}

export default function BetweenPage() {
    return (
        <Suspense fallback={null}>
            <BetweenContent />
        </Suspense>
    );
}
