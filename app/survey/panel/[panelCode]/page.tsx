'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import QuestionRenderer, { Question } from '@/components/survey/QuestionRenderer';
import ProgressBar from '@/components/survey/ProgressBar';

interface PhaseInfo {
    phase_code: string;
    phase_name: string;
    sort_order: number;
    progress?: { status: string };
}

const PANEL_META: Record<string, { title: string; subtitle: string; description: string; emoji: string }> = {
    panel_1: {
        title: 'Panel 1',
        subtitle: 'Ideation & Research Translation',
        description: 'This panel focuses on your experience at the ideation stage (T0-T1). We\'d like to understand the bottlenecks and enablers in initiating research translation.',
        emoji: '💡',
    },
    panel_2: {
        title: 'Panel 2',
        subtitle: 'Prototyping & Trials',
        description: 'This panel explores the prototyping and trials stage (T2-T3) — the challenges you face and what enables progress when moving from lab to real-world application.',
        emoji: '🔬',
    },
    panel_3: {
        title: 'Panel 3',
        subtitle: 'Scale-Up',
        description: 'This panel covers the scale-up phase (T4-T5). Questions will be made available by the organizers shortly.',
        emoji: '🚀',
    },
    closing: {
        title: 'Closing Survey',
        subtitle: 'Reflections & Collaboration',
        description: 'Thank you for participating in the entire forum. This final survey captures your overall reflections and collaboration interests.',
        emoji: '🤝',
    },
};

const QUESTIONS_PER_STEP = 3;
const AUTOSAVE_DEBOUNCE_MS = 1800;

export default function PanelPage() {
    const router = useRouter();
    const params = useParams();
    const panelCode = params.panelCode as string;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [panels, setPanels] = useState<PhaseInfo[]>([]);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [submitError, setSubmitError] = useState('');
    const [panelError, setPanelError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [welcomed, setWelcomed] = useState(false); // welcome screen shown first

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionToken = typeof window !== 'undefined'
        ? localStorage.getItem('respondent_session_token') || '' : '';

    // ── Load questions + state ──────────────────────────────────────────
    useEffect(() => {
        if (!sessionToken) { router.push('/'); return; }
        (async () => {
            try {
                const [qRes, resumeRes] = await Promise.all([
                    fetch(`/api/survey/questions?phase=${panelCode}`),
                    fetch('/api/respondent/resume', { headers: { 'x-session-token': sessionToken } }),
                ]);
                const qData = await qRes.json();
                const resumeData = await resumeRes.json();

                if (!qRes.ok || !qData.questions) {
                    setPanelError('Could not load questionnaire.'); setLoading(false); return;
                }

                if (resumeData.success && resumeData.phases) {
                    setPanels(resumeData.phases);
                    const currentPanel = resumeData.phases.find((p: PhaseInfo) => p.phase_code === panelCode);
                    if (!currentPanel) { setPanelError('Panel not found.'); setLoading(false); return; }

                    // Phase locking — redirect to first incomplete panel
                    const sorted: PhaseInfo[] = [...resumeData.phases].sort((a, b) => a.sort_order - b.sort_order);
                    for (const p of sorted) {
                        if (p.phase_code === panelCode) break;
                        if (!p.progress || p.progress.status !== 'completed') {
                            router.push(`/survey/panel/${p.phase_code}`); return;
                        }
                    }

                    // If already completed, skip straight past welcome
                    if (currentPanel.progress?.status === 'completed') {
                        setWelcomed(true);
                    }

                    // Restore saved answers
                    if (resumeData.saved_responses) {
                        const idToCode = Object.fromEntries(
                            (qData.questions as Question[]).map((q: Question) => [q.id, q.question_code])
                        );
                        const restored: Record<string, unknown> = {};
                        for (const [qId, val] of Object.entries(resumeData.saved_responses)) {
                            const code = idToCode[qId];
                            if (code) restored[code] = val;
                        }
                        setAnswers(restored);
                    }
                }
                setQuestions(qData.questions);
            } catch {
                setPanelError('Failed to load questionnaire. Please refresh.');
            }
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panelCode]);

    // ── Steps ─────────────────────────────────────────────────────────────
    const steps: Question[][] = [];
    for (let i = 0; i < questions.length; i += QUESTIONS_PER_STEP) {
        steps.push(questions.slice(i, i + QUESTIONS_PER_STEP));
    }
    const currentStepQs = steps[stepIndex] || [];

    // ── Auto-save ─────────────────────────────────────────────────────────
    const debouncedSave = useCallback((updated: Record<string, unknown>) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            setSaving(true);
            const toSave = questions
                .filter(q => updated[q.question_code] !== undefined)
                .map(q => ({ question_id: q.id, answer_value_json: updated[q.question_code] }));
            if (toSave.length > 0) {
                try {
                    await fetch('/api/responses/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
                        body: JSON.stringify({ answers: toSave, phase_code: panelCode, step_code: `step_${stepIndex}` }),
                    });
                    setLastSaved(new Date());
                } catch { /* non-fatal */ }
            }
            setSaving(false);
        }, AUTOSAVE_DEBOUNCE_MS);
    }, [questions, sessionToken, panelCode, stepIndex]);

    function handleAnswerChange(code: string, value: unknown) {
        const next = { ...answers, [code]: value };
        setAnswers(next);
        debouncedSave(next);
    }

    // ── Validation ────────────────────────────────────────────────────────
    function validateStep(): string | null {
        for (const q of currentStepQs) {
            const cond = q.conditional_logic_json?.show_if;
            if (cond) {
                const dep = answers[cond.question_code];
                const depArr = Array.isArray(dep) ? dep as string[] : [String(dep ?? '')];
                if (!cond.answer_in.some(a => depArr.includes(a))) continue;
            }
            if (!q.is_required) continue;
            const val = answers[q.question_code];
            if (val === undefined || val === null || val === '') return `Please answer: "${q.prompt}"`;
            if (q.question_type === 'multi_select') {
                const arr = Array.isArray(val) ? val as unknown[] : [];
                if (q.selection_min && arr.length < q.selection_min)
                    return `Select at least ${q.selection_min} options for: "${q.prompt}"`;
                if (q.selection_max && arr.length > q.selection_max)
                    return `Select at most ${q.selection_max} options for: "${q.prompt}"`;
            }
        }
        return null;
    }

    async function saveAll(stepCode?: string) {
        const toSave = questions
            .filter(q => answers[q.question_code] !== undefined)
            .map(q => ({ question_id: q.id, answer_value_json: answers[q.question_code] }));
        if (toSave.length === 0) return;
        await fetch('/api/responses/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
            body: JSON.stringify({ answers: toSave, phase_code: panelCode, step_code: stepCode }),
        });
        setLastSaved(new Date());
    }

    async function handleNext() {
        setSubmitError('');
        const err = validateStep();
        if (err) { setSubmitError(err); return; }
        await saveAll(`step_${stepIndex + 1}`);
        setStepIndex(i => i + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleBack() {
        setSubmitError('');
        setStepIndex(i => Math.max(0, i - 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleSubmitPanel() {
        setSubmitError('');
        const err = validateStep();
        if (err) { setSubmitError(err); return; }
        setSubmitting(true);
        await saveAll();
        const res = await fetch('/api/phase/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
            body: JSON.stringify({ phase_code: panelCode }),
        });
        const data = await res.json();
        setSubmitting(false);
        if (!res.ok || !data.success) { setSubmitError(data.error || 'Submission failed. Please try again.'); return; }
        if (data.next_phase === 'done') {
            router.push('/survey/done');
        } else {
            router.push(`/survey/between?from=${panelCode}`);
        }
    }

    const currentPanelInfo = panels.find(p => p.phase_code === panelCode);
    const meta = PANEL_META[panelCode] || { title: panelCode, subtitle: '', description: '', emoji: '📋' };
    const isLastStep = stepIndex === steps.length - 1;

    // ── LOADING ────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center">
                <svg className="animate-spin w-8 h-8 text-blue-400/60" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
            </main>
        );
    }

    // ── ERROR ──────────────────────────────────────────────────────────────
    if (panelError) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-8 text-center max-w-sm w-full">
                    <p className="text-red-300 mb-4">{panelError}</p>
                    <button onClick={() => router.push('/')} className="text-blue-400 text-sm hover:underline">Return to Start</button>
                </div>
            </main>
        );
    }

    // ── WELCOME SCREEN ─────────────────────────────────────────────────────
    if (!welcomed) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    {/* Badge */}
                    <div className="flex justify-center mb-6">
                        <span className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full">
                            UK–Indonesia Research Forum
                        </span>
                    </div>

                    {/* Emoji + title */}
                    <div className="text-center mb-8">
                        <div className="text-6xl mb-4">{meta.emoji}</div>
                        <h1 className="text-3xl font-bold text-white mb-1">{meta.title}</h1>
                        <p className="text-blue-300/70 text-sm font-medium">{meta.subtitle}</p>
                    </div>

                    {/* Description card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                        <p className="text-white/70 text-sm leading-relaxed">{meta.description}</p>
                        {questions.length > 0 && (
                            <p className="text-white/30 text-xs mt-4">
                                {questions.length} question{questions.length !== 1 ? 's' : ''} · approx. {Math.ceil(questions.length * 0.5)} min
                            </p>
                        )}
                    </div>

                    {/* Tips */}
                    <div className="flex items-start gap-3 mb-8 px-1">
                        <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-white/35 text-xs leading-relaxed">
                            Your progress is saved automatically. You can close and return using the same link and phone number.
                        </p>
                    </div>

                    {/* Begin button */}
                    <button
                        onClick={() => setWelcomed(true)}
                        className="w-full bg-blue-500 active:bg-blue-600 hover:bg-blue-400 text-white font-semibold
              py-4 px-6 rounded-2xl transition-all duration-200 text-base flex items-center justify-center gap-2"
                    >
                        {questions.length === 0 ? 'View Panel' : 'Begin Questionnaire'} →
                    </button>

                    <p className="text-center text-white/20 text-xs mt-6">
                        Your answers are stored securely and used for research analysis only.
                    </p>
                </div>
            </main>
        );
    }

    // ── NO QUESTIONS PLACEHOLDER ───────────────────────────────────────────
    if (questions.length === 0) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full">
                    <div className="text-4xl mb-4">🔒</div>
                    <p className="text-white/70 font-medium mb-2">Questions not yet available</p>
                    <p className="text-white/40 text-sm mb-6">This panel will be released by the organizers soon.</p>
                    <button onClick={() => router.push('/')} className="text-blue-400 text-sm hover:underline">Return to Start</button>
                </div>
            </main>
        );
    }

    // ── QUESTIONNAIRE ──────────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900">
            <div className="max-w-xl mx-auto px-4 py-6 pb-24">

                {/* Top bar */}
                <div className="flex items-center justify-between mb-5">
                    <span className="text-white/40 text-xs font-medium">{meta.title}</span>
                    <span className="text-white/25 text-xs">
                        {saving ? '● Saving…' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                </div>

                {/* Progress */}
                <ProgressBar
                    phaseName={currentPanelInfo?.phase_name || meta.title}
                    phases={panels}
                    currentPhaseCode={panelCode}
                    stepIndex={stepIndex}
                    totalSteps={steps.length}
                />

                {/* Questions card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 md:p-8">
                    {currentStepQs.map(q => (
                        <QuestionRenderer
                            key={q.id}
                            question={q}
                            value={answers[q.question_code] ?? undefined}
                            onChange={val => handleAnswerChange(q.question_code, val)}
                            allAnswers={answers}
                        />
                    ))}

                    {submitError && (
                        <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
                            {submitError}
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky bottom navigation — great for mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-white/10 px-4 py-3 safe-area-inset-bottom">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
                    <button
                        onClick={handleBack}
                        disabled={stepIndex === 0}
                        className="flex items-center gap-1.5 text-white/40 disabled:opacity-0 disabled:pointer-events-none
              transition-all text-sm py-2 px-3 rounded-xl active:bg-white/10"
                    >
                        ← Back
                    </button>

                    <div className="text-white/20 text-xs">
                        {stepIndex + 1} / {steps.length}
                    </div>

                    {isLastStep ? (
                        <button
                            onClick={handleSubmitPanel}
                            disabled={submitting}
                            className="flex items-center gap-2 bg-green-500 active:bg-green-600 hover:bg-green-400
                disabled:opacity-50 text-white font-semibold py-2.5 px-5 rounded-xl transition-all text-sm"
                        >
                            {submitting ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Submitting…
                                </>
                            ) : 'Submit Panel ✓'}
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="bg-blue-500 active:bg-blue-600 hover:bg-blue-400 text-white font-semibold
                py-2.5 px-5 rounded-xl transition-all text-sm"
                        >
                            Next →
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
