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

const QUESTIONS_PER_STEP = 3;
const AUTOSAVE_DEBOUNCE_MS = 1800;

/**
 * Survey Phase Page — PRD §5.4, §5.6
 * Dynamically loads questions, steps through them, auto-saves, handles phase completion.
 */
export default function PhasePage() {
    const router = useRouter();
    const params = useParams();
    const phaseCode = params.phaseCode as string;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [phases, setPhases] = useState<PhaseInfo[]>([]);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [submitError, setSubmitError] = useState('');
    const [phaseError, setPhaseError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionToken = typeof window !== 'undefined'
        ? localStorage.getItem('respondent_session_token') || ''
        : '';

    // Load questions + respondent state
    useEffect(() => {
        if (!sessionToken) { router.push('/'); return; }
        (async () => {
            try {
                // Fetch questions for this phase
                const [qRes, resumeRes] = await Promise.all([
                    fetch(`/api/survey/questions?phase=${phaseCode}`),
                    fetch('/api/respondent/resume', {
                        headers: { 'x-session-token': sessionToken },
                    }),
                ]);
                const qData = await qRes.json();
                const resumeData = await resumeRes.json();

                if (!qRes.ok || !qData.questions) {
                    setPhaseError('Could not load survey questions.');
                    setLoading(false); return;
                }

                // Phase locking check (PRD §5.6)
                if (resumeData.success && resumeData.phases) {
                    setPhases(resumeData.phases);
                    const currentPhase = resumeData.phases.find(
                        (p: PhaseInfo) => p.phase_code === phaseCode
                    );
                    if (!currentPhase) {
                        setPhaseError('Phase not found.');
                        setLoading(false); return;
                    }

                    // Determine if locked: any earlier required phase is not completed
                    const sortedPhases: PhaseInfo[] = [...resumeData.phases].sort((a, b) => a.sort_order - b.sort_order);
                    for (const p of sortedPhases) {
                        if (p.phase_code === phaseCode) break;
                        if (!p.progress || p.progress.status !== 'completed') {
                            router.push(`/survey/phase/${p.phase_code}`);
                            return;
                        }
                    }

                    // Restore saved answers
                    if (resumeData.saved_responses) {
                        const codeToId = Object.fromEntries(
                            (qData.questions as Question[]).map((q: Question) => [q.id, q.question_code])
                        );
                        const restored: Record<string, unknown> = {};
                        for (const [qId, val] of Object.entries(resumeData.saved_responses)) {
                            const code = codeToId[qId];
                            if (code) restored[code] = val;
                        }
                        setAnswers(restored);
                    }
                }

                setQuestions(qData.questions);
            } catch {
                setPhaseError('Failed to load questionnaire. Please refresh the page.');
            }
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phaseCode]);

    // Group questions into steps of QUESTIONS_PER_STEP
    const steps = [];
    for (let i = 0; i < questions.length; i += QUESTIONS_PER_STEP) {
        steps.push(questions.slice(i, i + QUESTIONS_PER_STEP));
    }
    const currentStepQuestions = steps[stepIndex] || [];

    // Get question_code → value answer map keyed by code
    function getAnswerByCode(code: string) {
        return answers[code] ?? undefined;
    }

    // Debounced auto-save (PRD §5.4.3)
    const debouncedSave = useCallback((updatedAnswers: Record<string, unknown>) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            setSaving(true);
            try {
                const toSave = questions
                    .filter(q => updatedAnswers[q.question_code] !== undefined)
                    .map(q => ({
                        question_id: q.id,
                        answer_value_json: updatedAnswers[q.question_code],
                    }));
                if (toSave.length === 0) { setSaving(false); return; }
                await fetch('/api/responses/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-token': sessionToken,
                    },
                    body: JSON.stringify({
                        answers: toSave,
                        phase_code: phaseCode,
                        step_code: `step_${stepIndex}`,
                    }),
                });
                setLastSaved(new Date());
            } catch { /* non-fatal */ }
            setSaving(false);
        }, AUTOSAVE_DEBOUNCE_MS);
    }, [questions, sessionToken, phaseCode, stepIndex]);

    function handleAnswerChange(questionCode: string, value: unknown) {
        const next = { ...answers, [questionCode]: value };
        setAnswers(next);
        debouncedSave(next);
    }

    // Validate current step (PRD §5.4.2, §10.3)
    function validateStep(): string | null {
        for (const q of currentStepQuestions) {
            // Skip if conditional makes it invisible
            const cond = q.conditional_logic_json?.show_if;
            if (cond) {
                const dep = answers[cond.question_code];
                const depArr = Array.isArray(dep) ? dep as string[] : [String(dep ?? '')];
                if (!cond.answer_in.some(a => depArr.includes(a))) continue;
            }
            if (!q.is_required) continue;
            const val = answers[q.question_code];
            if (val === undefined || val === null || val === '') {
                return `Please answer: "${q.prompt}"`;
            }
            if (q.question_type === 'multi_select') {
                const arr = Array.isArray(val) ? val as unknown[] : [];
                if (q.selection_min && arr.length < q.selection_min) {
                    return `Please select at least ${q.selection_min} option(s) for: "${q.prompt}"`;
                }
                if (q.selection_max && arr.length > q.selection_max) {
                    return `Please select at most ${q.selection_max} option(s) for: "${q.prompt}"`;
                }
            }
        }
        return null;
    }

    async function handleNext() {
        setSubmitError('');
        const validationError = validateStep();
        if (validationError) { setSubmitError(validationError); return; }

        // Save current step answers immediately before advancing
        const toSave = questions
            .filter(q => answers[q.question_code] !== undefined)
            .map(q => ({ question_id: q.id, answer_value_json: answers[q.question_code] }));
        if (toSave.length > 0) {
            await fetch('/api/responses/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
                body: JSON.stringify({ answers: toSave, phase_code: phaseCode, step_code: `step_${stepIndex + 1}` }),
            });
            setLastSaved(new Date());
        }
        setStepIndex(i => i + 1);
        window.scrollTo(0, 0);
    }

    async function handleBack() {
        setSubmitError('');
        setStepIndex(i => Math.max(0, i - 1));
        window.scrollTo(0, 0);
    }

    // Final phase submission (PRD §5.6)
    async function handleSubmitPhase() {
        setSubmitError('');
        const validationError = validateStep();
        if (validationError) { setSubmitError(validationError); return; }
        setSubmitting(true);

        // Save all answers
        const toSave = questions
            .filter(q => answers[q.question_code] !== undefined)
            .map(q => ({ question_id: q.id, answer_value_json: answers[q.question_code] }));
        if (toSave.length > 0) {
            await fetch('/api/responses/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
                body: JSON.stringify({ answers: toSave, phase_code: phaseCode }),
            });
        }

        const res = await fetch('/api/phase/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
            body: JSON.stringify({ phase_code: phaseCode }),
        });
        const data = await res.json();
        setSubmitting(false);

        if (!res.ok || !data.success) {
            setSubmitError(data.error || 'Submission failed. Please try again.');
            return;
        }

        // Closing phase → done; all other completed phases → between-phase interstitial
        if (data.next_phase === 'done') {
            router.push('/survey/done');
        } else {
            // Show "thank you / scan QR" page; next phase is entered via a separate QR link
            router.push(`/survey/between?from=${phaseCode}`);
        }
    }

    const currentPhaseInfo = phases.find(p => p.phase_code === phaseCode);

    if (loading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center">
                <div className="text-white/60 flex items-center gap-3">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Loading questionnaire…
                </div>
            </main>
        );
    }

    if (phaseError) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-8 text-center max-w-sm">
                    <p className="text-red-300 mb-4">{phaseError}</p>
                    <button onClick={() => router.push('/')} className="text-blue-400 text-sm hover:underline">
                        Return to Start
                    </button>
                </div>
            </main>
        );
    }

    if (questions.length === 0) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center max-w-sm">
                    <p className="text-white/60 mb-2">No questions available for this phase yet.</p>
                    <p className="text-white/30 text-sm mb-6">This section will be released soon.</p>
                    <button onClick={() => router.push('/')} className="text-blue-400 text-sm hover:underline">
                        Return to Start
                    </button>
                </div>
            </main>
        );
    }

    const isLastStep = stepIndex === steps.length - 1;

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-4">
            <div className="max-w-2xl mx-auto py-8">
                {/* Progress */}
                <ProgressBar
                    phaseName={currentPhaseInfo?.phase_name || phaseCode}
                    phases={phases}
                    currentPhaseCode={phaseCode}
                    stepIndex={stepIndex}
                    totalSteps={steps.length}
                />

                {/* Questions card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    {currentStepQuestions.map(q => (
                        <QuestionRenderer
                            key={q.id}
                            question={q}
                            value={getAnswerByCode(q.question_code)}
                            onChange={val => handleAnswerChange(q.question_code, val)}
                            allAnswers={answers}
                        />
                    ))}

                    {submitError && (
                        <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm mb-5">
                            {submitError}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
                        <button
                            onClick={handleBack}
                            disabled={stepIndex === 0}
                            className="text-white/40 hover:text-white/70 disabled:opacity-0 disabled:pointer-events-none transition-all text-sm flex items-center gap-1.5"
                        >
                            ← Back
                        </button>

                        <div className="flex items-center gap-3">
                            {/* Save status */}
                            <span className="text-white/25 text-xs">
                                {saving ? 'Saving…' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
                            </span>

                            {isLastStep ? (
                                <button
                                    onClick={handleSubmitPhase}
                                    disabled={submitting}
                                    className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold
                    py-2.5 px-6 rounded-xl transition-all duration-200 flex items-center gap-2 text-sm"
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
                                    className="bg-blue-500 hover:bg-blue-400 text-white font-semibold
                    py-2.5 px-6 rounded-xl transition-all duration-200 text-sm"
                                >
                                    Next →
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
