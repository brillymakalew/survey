export default function SurveyDone() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                {/* Success icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border border-green-400/30 mb-6">
                    <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold text-white mb-3">Thank You!</h1>
                <p className="text-blue-200/60 text-base leading-relaxed mb-8">
                    You have completed all panels of the questionnaire. Your responses have been saved.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left space-y-4 mb-8">
                    <h2 className="text-white font-semibold">What happens next?</h2>
                    <ul className="space-y-3 text-white/60 text-sm">
                        <li className="flex gap-3">
                            <span className="text-blue-400 mt-0.5">→</span>
                            <span>Your answers will be reviewed by the forum organizers to support research translation analysis.</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="text-blue-400 mt-0.5">→</span>
                            <span>If you expressed interest in collaboration, the team may reach out for follow-up matchmaking.</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="text-blue-400 mt-0.5">→</span>
                            <span>Aggregate insights from all participants will be shared with forum attendees.</span>
                        </li>
                    </ul>
                </div>

                <p className="text-white/20 text-xs">
                    You may safely close this window. Your progress is saved and will not be lost.
                </p>
            </div>
        </main>
    );
}
