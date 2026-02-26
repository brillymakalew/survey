'use client';

import { useCallback } from 'react';

export interface Question {
    id: string;
    question_code: string;
    section_code?: string;
    prompt: string;
    help_text?: string;
    question_type: 'single_choice' | 'multi_select' | 'likert' | 'short_text' | 'long_text';
    options_json?: string[] | null;
    selection_min?: number | null;
    selection_max?: number | null;
    is_required: boolean;
    conditional_logic_json?: {
        show_if?: {
            question_code: string;
            answer_in: string[];
        };
    } | null;
    sort_order: number;
}

interface Props {
    question: Question;
    value: unknown;
    onChange: (value: unknown) => void;
    allAnswers: Record<string, unknown>; // question_code → value
}

/**
 * QuestionRenderer — PRD §5.4, §10.4
 * Renders all question types with conditional visibility and selection limits.
 */
export default function QuestionRenderer({ question, value, onChange, allAnswers }: Props) {
    // Conditional visibility check (PRD §10.4)
    const cond = question.conditional_logic_json?.show_if;
    if (cond) {
        const depAnswer = allAnswers[cond.question_code];
        // Handle both string values and array values (for multi_select parents)
        const depAnswerArr = Array.isArray(depAnswer)
            ? (depAnswer as string[])
            : [String(depAnswer ?? '')];
        const visible = cond.answer_in.some(a => depAnswerArr.includes(a));
        if (!visible) return null;
    }

    const handleMultiSelect = useCallback((opt: string) => {
        const current = Array.isArray(value) ? (value as string[]) : [];
        const max = question.selection_max ?? Infinity;
        if (current.includes(opt)) {
            onChange(current.filter(v => v !== opt));
        } else if (current.length < max) {
            onChange([...current, opt]);
        }
    }, [value, question.selection_max, onChange]);

    const selectedArr = Array.isArray(value) ? (value as string[]) : [];
    const atMax = selectedArr.length >= (question.selection_max ?? Infinity);

    return (
        <div className="mb-7">
            <label className="block text-white font-medium mb-1 leading-snug">
                {question.prompt}
                {question.is_required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {question.help_text && (
                <p className="text-blue-200/50 text-sm mb-3">{question.help_text}</p>
            )}

            {/* Single Choice */}
            {question.question_type === 'single_choice' && (
                <div className="space-y-2">
                    {(question.options_json || []).map(opt => (
                        <label
                            key={opt}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${value === opt
                                    ? 'border-blue-400/60 bg-blue-500/15 text-white'
                                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10'
                                }`}
                        >
                            <input
                                type="radio"
                                name={question.question_code}
                                value={opt}
                                checked={value === opt}
                                onChange={() => onChange(opt)}
                                className="sr-only"
                            />
                            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${value === opt ? 'border-blue-400 bg-blue-400' : 'border-white/30'
                                }`}>
                                {value === opt && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                            <span className="text-sm">{opt}</span>
                        </label>
                    ))}
                </div>
            )}

            {/* Multi Select (PRD §10.3) */}
            {question.question_type === 'multi_select' && (
                <div className="space-y-2">
                    {(question.selection_min || question.selection_max) && (
                        <p className="text-blue-300/60 text-xs mb-2">
                            Select {question.selection_min === question.selection_max
                                ? `exactly ${question.selection_max}`
                                : `${question.selection_min}–${question.selection_max}`} option(s)
                            &nbsp;({selectedArr.length}/{question.selection_max} selected)
                        </p>
                    )}
                    {(question.options_json || []).map(opt => {
                        const selected = selectedArr.includes(opt);
                        return (
                            <label
                                key={opt}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selected
                                        ? 'border-blue-400/60 bg-blue-500/15 text-white'
                                        : atMax && !selected
                                            ? 'border-white/5 bg-white/3 text-white/30 cursor-not-allowed'
                                            : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => handleMultiSelect(opt)}
                                    disabled={atMax && !selected}
                                    className="sr-only"
                                />
                                <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-blue-400 bg-blue-400' : 'border-white/30'
                                    }`}>
                                    {selected && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </span>
                                <span className="text-sm">{opt}</span>
                            </label>
                        );
                    })}
                </div>
            )}

            {/* Likert Scale 1–7 */}
            {question.question_type === 'likert' && (
                <div>
                    <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => onChange(n)}
                                className={`w-11 h-11 rounded-lg border font-semibold text-sm transition-all ${value === n
                                        ? 'border-blue-400 bg-blue-500 text-white'
                                        : 'border-white/20 bg-white/5 text-white/60 hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-white'
                                    }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between text-white/30 text-xs mt-2 px-1">
                        <span>Strongly Disagree</span>
                        <span>Strongly Agree</span>
                    </div>
                </div>
            )}

            {/* Short Text */}
            {question.question_type === 'short_text' && (
                <input
                    type="text"
                    value={typeof value === 'string' ? value : ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Type your answer…"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/50 transition-all"
                />
            )}

            {/* Long Text */}
            {question.question_type === 'long_text' && (
                <textarea
                    value={typeof value === 'string' ? value : ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Type your answer…"
                    rows={5}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/50 transition-all resize-none"
                />
            )}
        </div>
    );
}
