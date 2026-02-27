interface ProgressBarProps {
    phaseName: string;
    phases: Array<{
        phase_code: string;
        phase_name: string;
        sort_order: number;
        progress?: { status: string };
    }>;
    currentPhaseCode: string;
    stepIndex: number;
    totalSteps: number;
}

/**
 * ProgressBar — PRD §6.1 — phase indicator + step progress bar.
 */
export default function ProgressBar({
    phaseName, phases, currentPhaseCode, stepIndex, totalSteps,
}: ProgressBarProps) {
    const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order);
    const currentIdx = sorted.findIndex(p => p.phase_code === currentPhaseCode);

    return (
        <div className="mb-8">
            {/* Phase dots / stepper */}
            <div className="flex items-center gap-0 mb-4">
                {sorted.map((phase, idx) => {
                    const isCompleted = phase.progress?.status === 'completed';
                    const isCurrent = phase.phase_code === currentPhaseCode;
                    const isPast = idx < currentIdx;
                    return (
                        <div key={phase.phase_code} className={`${idx === sorted.length - 1 ? 'flex-none' : 'flex-1'} flex items-center`}>
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold flex-shrink-0 transition-all ${isCompleted || isPast
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : isCurrent
                                    ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                                    : 'bg-white/5 border-white/20 text-white/30'
                                }`}>
                                {isCompleted || isPast ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : idx + 1}
                            </div>
                            {idx < sorted.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 transition-all ${isPast || isCompleted ? 'bg-blue-500' : 'bg-white/10'
                                    }`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Phase name + step counter */}
            <div className="flex items-center justify-between mb-1">
                <span className="text-white font-semibold text-sm">{phaseName}</span>
                <span className="text-white/40 text-xs">Step {stepIndex + 1} of {totalSteps}</span>
            </div>
            {/* Step progress bar */}
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0}%` }}
                />
            </div>
        </div>
    );
}
