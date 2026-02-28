'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

type TabId = 'overview' | 'funnel' | 'phases' | 'crosstabs' | 'responses' | 'questions' | 'exports';

interface Respondent {
    id: string; full_name: string; phone_normalized: string;
    current_phase: string; status: string; created_at: string; last_seen_at?: string;
}
interface PhaseStats {
    phase_code: string; phase_name: string; completed_count: number;
    total_with_progress: number; completion_rate_pct: number; avg_completion_minutes: number;
}
interface FunnelEntry { label: string; value: number; }
interface AffiliationRow { affiliation: string; country_base: string; respondent_count: number; }
interface IntentRow { intent: string; respondent_count: number; pct: number; }
interface OverviewData {
    total_respondents: number;
    funnel: Record<string, number>;
    phase_stats: PhaseStats[];
    affiliation_breakdown: AffiliationRow[];
    collaboration_intent: IntentRow[];
    recent_respondents: Respondent[];
}
interface Pagination { page: number; total_pages: number; total: number; }

interface QuestionData {
    option_counts: { question_code: string; prompt: string; question_type: string; opt_value: string; selection_count: number; }[];
    likert_summary: { question_code: string; prompt: string; avg_score: number; response_count: number; min_score: number; max_score: number; }[];
}

const PHASES = ['panel_1', 'panel_2', 'panel_3', 'closing'];
const FUNNEL_LABELS: Record<string, string> = {
    total_respondents: 'Identity Entered',
    phase1_started: 'Panel 1 Started',
    phase1_completed: 'Panel 1 Completed',
    phase2_completed: 'Panel 2 Completed',
    phase3_completed: 'Panel 3 Completed',
    closing_completed: 'Closing Completed',
};

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [respondents, setRespondents] = useState<Respondent[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, total_pages: 1, total: 0 });
    const [search, setSearch] = useState('');
    const [phaseFilter, setPhaseFilter] = useState('');
    const [affiliationFilter, setAffiliationFilter] = useState('');
    const [countryFilter, setCountryFilter] = useState('');

    const [questionsData, setQuestionsData] = useState<QuestionData | null>(null);
    const [qLoading, setQLoading] = useState(false);

    // New State for Clear Data Feature
    const [showClearModal, setShowClearModal] = useState(false);
    const [clearInput, setClearInput] = useState('');
    const [isClearing, setIsClearing] = useState(false);

    // New State for Full Screen Chart
    const [fullScreenChart, setFullScreenChart] = useState<string | null>(null);

    // New State for Import Data Feature
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importType, setImportType] = useState('respondents');
    const [isImporting, setIsImporting] = useState(false);
    const [importMessage, setImportMessage] = useState('');

    // Fetch overview data
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/admin/dashboard/overview');
                if (res.status === 401) { router.push('/admin/login'); return; }
                const data = await res.json();
                if (data.success) setOverview(data.overview);
            } catch { /* show stale data */ }
            setLoading(false);
        })();
    }, [router]);

    // Fetch respondents list
    useEffect(() => {
        if (activeTab !== 'responses') return;
        (async () => {
            const params = new URLSearchParams({
                page: String(pagination.page),
                page_size: '20',
                ...(search && { search }),
                ...(phaseFilter && { phase: phaseFilter }),
            });
            const res = await fetch(`/api/admin/dashboard/respondents?${params}`);
            if (res.status === 401) { router.push('/admin/login'); return; }
            const data = await res.json();
            if (data.success) {
                setRespondents(data.respondents);
                setPagination({ page: data.page, total_pages: data.total_pages, total: data.total });
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, pagination.page, search, phaseFilter]);

    // Fetch questions data
    useEffect(() => {
        if (activeTab !== 'questions') return;
        (async () => {
            setQLoading(true);
            try {
                const params = new URLSearchParams({ phase: phaseFilter || 'panel_1' });
                if (affiliationFilter) params.append('affiliation', affiliationFilter);
                if (countryFilter) params.append('country', countryFilter);

                const res = await fetch(`/api/admin/dashboard/questions?${params}`);
                if (res.status === 401) { router.push('/admin/login'); return; }
                const data = await res.json();
                if (data.success) {
                    setQuestionsData({
                        option_counts: data.option_counts,
                        likert_summary: data.likert_summary
                    });
                }
            } catch { /* ignore */ }
            setQLoading(false);
        })();
    }, [activeTab, phaseFilter, affiliationFilter, countryFilter, router]);

    // Action: Clear Data
    async function handleClearData() {
        if (clearInput !== 'saya setuju') return;
        setIsClearing(true);
        try {
            const res = await fetch('/api/admin/dashboard/clear-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intent: clearInput }),
            });
            const data = await res.json();
            if (data.success) {
                setShowClearModal(false);
                setClearInput('');
                // Refresh cleanly
                window.location.reload();
            } else {
                alert(data.error || 'Failed to clear data.');
            }
        } catch {
            alert('Network error while clearing data.');
        }
        setIsClearing(false);
    }

    async function handleLogout() {
        await fetch('/api/admin/logout', { method: 'POST' });
        router.push('/admin/login');
    }

    async function handleImport(e: React.FormEvent) {
        e.preventDefault();
        if (!importFile) return;
        setIsImporting(true);
        setImportMessage('');

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('type', importType);

        try {
            const res = await fetch('/api/admin/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                setImportMessage(`Success: ${data.message}`);
                setImportFile(null);
                // Clear input file
                const fileInput = document.getElementById('importFileInput') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                setImportMessage(`Error: ${data.error}`);
            }
        } catch (err) {
            setImportMessage('Network error during import.');
        }
        setIsImporting(false);
    }

    const funnel: FunnelEntry[] = overview
        ? Object.entries(FUNNEL_LABELS).map(([key, label]) => ({
            label,
            value: (overview.funnel as Record<string, number>)?.[key] ?? 0,
        }))
        : [];

    const affiliationPie = (() => {
        const map = new Map<string, number>();
        overview?.affiliation_breakdown?.forEach(r => map.set(r.affiliation, (map.get(r.affiliation) || 0) + r.respondent_count));
        return Array.from(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
    })();

    const countryPie = (() => {
        const map = new Map<string, number>();
        overview?.affiliation_breakdown?.forEach(r => map.set(r.country_base, (map.get(r.country_base) || 0) + r.respondent_count));
        return Array.from(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
    })();

    const tabs: { id: TabId; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'funnel', label: 'Funnel' },
        { id: 'phases', label: 'Per Phase' },
        { id: 'crosstabs', label: 'Crosstabs' },
        { id: 'responses', label: 'Responses' },
        { id: 'questions', label: 'Questions' },
        { id: 'exports', label: 'Exports' },
    ];

    return (
        <main className="min-h-screen bg-slate-900 text-white pb-24">
            {/* Header */}
            <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur sticky top-0 z-20 pt-14 md:pt-0 md:pl-52">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <h1 className="font-bold text-lg">Survey Admin</h1>
                    <button
                        onClick={handleLogout}
                        className="text-white/40 hover:text-white text-sm transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
                <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === t.id
                                ? 'border-blue-400 text-blue-300'
                                : 'border-transparent text-white/40 hover:text-white/70'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {loading && (
                    <div className="text-white/40 text-sm flex items-center gap-2 mb-6">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Loading…
                    </div>
                )}

                {/* ── OVERVIEW ─────────────────────────────────── */}
                {activeTab === 'overview' && overview && (
                    <div className="space-y-8">
                        {/* KPI cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: 'Registered', value: overview.total_respondents },
                                { label: 'Started P1', value: overview.funnel?.phase1_started ?? 0 },
                                { label: 'Finished P1', value: overview.funnel?.phase1_completed ?? 0 },
                                { label: 'Finished P2', value: overview.funnel?.phase2_completed ?? 0 },
                                { label: 'Finished P3', value: overview.funnel?.phase3_completed ?? 0 },
                                { label: 'Closing Done', value: overview.funnel?.closing_completed ?? 0 },
                            ].map(card => (
                                <div key={card.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <p className="text-white/40 text-xs mb-1">{card.label}</p>
                                    <p className="text-2xl font-bold text-white">{card.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Top Level Graphs */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Line / Bar Chart for Funnel across the width */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:col-span-3">
                                <h2 className="font-semibold mb-6 text-sm">Overall Progression</h2>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={funnel} margin={{ left: -20, right: 0, top: 20, bottom: 0 }}>
                                        <XAxis dataKey="label" stroke="#ffffff33" tick={{ fill: '#ffffff66', fontSize: 11 }} />
                                        <YAxis stroke="#ffffff33" tick={{ fill: '#ffffff66', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #ffffff20', borderRadius: 8 }} itemStyle={{ color: '#ffffff' }} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#ffffff90', fontSize: 12, fontWeight: 'bold' }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Collaboration intent pie */}
                            {overview.collaboration_intent.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative flex flex-col items-center">
                                    <div className="flex justify-between items-start w-full mb-2 gap-4">
                                        <h2 className="font-semibold text-sm">Collaboration Intent</h2>
                                        <button
                                            onClick={() => setFullScreenChart('pie')}
                                            className="text-white/40 hover:text-white p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                                            title="View Full Screen"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                            </svg>
                                        </button>
                                    </div>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={overview.collaboration_intent} dataKey="respondent_count" nameKey="intent"
                                                cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                                                label={false}>
                                                {overview.collaboration_intent.map((_entry, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }} itemStyle={{ color: '#ffffff' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Affiliation Pie */}
                            {affiliationPie.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative flex flex-col items-center">
                                    <div className="flex justify-between items-start w-full mb-2 gap-4">
                                        <h2 className="font-semibold text-sm">Affiliation</h2>
                                    </div>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={affiliationPie} dataKey="value" nameKey="name"
                                                cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                                                label={false}>
                                                {affiliationPie.map((_entry, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }} itemStyle={{ color: '#ffffff' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Country Base Pie */}
                            {countryPie.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative flex flex-col items-center">
                                    <div className="flex justify-between items-start w-full mb-2 gap-4">
                                        <h2 className="font-semibold text-sm">Country Base</h2>
                                    </div>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={countryPie} dataKey="value" nameKey="name"
                                                cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                                                label={false}>
                                                {countryPie.map((_entry, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }} itemStyle={{ color: '#ffffff' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Recent respondents */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h2 className="font-semibold mb-4">Recent Respondents</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-white/40 text-left border-b border-white/10">
                                            <th className="pb-2 pr-4">Name</th>
                                            <th className="pb-2 pr-4">Panel</th>
                                            <th className="pb-2 pr-4">Status</th>
                                            <th className="pb-2">Registered</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overview.recent_respondents.map(r => (
                                            <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="py-2.5 pr-4 text-white">{r.full_name}</td>
                                                <td className="py-2.5 pr-4 text-white/60 capitalize">{r.current_phase.replace('phase_', 'Panel ').replace('closing', 'Closing')}</td>
                                                <td className="py-2.5 pr-4">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/40'
                                                        }`}>{r.status}</span>
                                                </td>
                                                <td className="py-2.5 text-white/40">{new Date(r.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Danger Zone: Clear Data */}
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mt-8 flex items-center justify-between">
                            <div>
                                <h2 className="font-semibold text-red-400 mb-1">Danger Zone</h2>
                                <p className="text-white/60 text-sm">Permanently wipe all respondents and survey data from the database.</p>
                            </div>
                            <button
                                onClick={() => setShowClearModal(true)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Clear All Data
                            </button>
                        </div>
                    </div>
                )}

                {/* ── FUNNEL ───────────────────────────────────── */}
                {activeTab === 'funnel' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
                        <div className="flex justify-between items-start mb-6 gap-4">
                            <h2 className="font-semibold">Response Funnel</h2>
                            <button
                                onClick={() => setFullScreenChart('funnel')}
                                className="text-white/40 hover:text-white p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                                title="View Full Screen"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                        </div>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" stroke="#ffffff33" tick={{ fill: '#ffffff66', fontSize: 12 }} />
                                <YAxis dataKey="label" type="category" width={160} tick={{ fill: '#ffffff80', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #ffffff20', borderRadius: 8 }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#ffffff60', fontSize: 11 }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* ── PER PHASE ────────────────────────────────── */}
                {activeTab === 'phases' && overview && (
                    <div className="space-y-4">
                        <h2 className="font-semibold text-lg">Panel Completion</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {overview.phase_stats.map(ps => (
                                <div key={ps.phase_code} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                    <h3 className="font-medium text-blue-300 mb-3">{ps.phase_name}</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-white/60">
                                            <span>Completion Rate</span>
                                            <span className="text-white font-medium">{ps.completion_rate_pct ?? 0}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/10 rounded-full">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ps.completion_rate_pct ?? 0}%` }} />
                                        </div>
                                        <div className="flex justify-between text-white/40 text-xs pt-1">
                                            <span>{ps.completed_count ?? 0} completed / {ps.total_with_progress ?? 0} started</span>
                                            {ps.avg_completion_minutes > 0 && <span>~{ps.avg_completion_minutes} min avg</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── CROSSTABS ────────────────────────────────── */}
                {activeTab === 'crosstabs' && overview && (
                    <div className="space-y-6">
                        <h2 className="font-semibold text-lg">Affiliation × Country Breakdown</h2>
                        {overview.affiliation_breakdown.length === 0 ? (
                            <p className="text-white/40 text-sm">No data yet.</p>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-white/10">
                                        <tr className="text-white/40 text-left">
                                            <th className="px-5 py-3">Affiliation</th>
                                            <th className="px-5 py-3">Country Base</th>
                                            <th className="px-5 py-3">Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overview.affiliation_breakdown.map((row, i) => (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="px-5 py-3 text-white">{row.affiliation}</td>
                                                <td className="px-5 py-3 text-white/60">{row.country_base}</td>
                                                <td className="px-5 py-3 text-blue-300 font-medium">{row.respondent_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── RESPONSES ────────────────────────────────── */}
                {activeTab === 'responses' && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-3 items-center">
                            <input
                                type="text"
                                placeholder="Search by name…"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                                className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm
                  placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/40 w-56"
                            />
                            <select
                                value={phaseFilter}
                                onChange={e => { setPhaseFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                                className="bg-slate-800 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            >
                                <option value="">All Panels</option>
                                {PHASES.map(p => <option key={p} value={p}>{p.replace('phase_', 'Panel ').replace('closing', 'Closing')}</option>)}
                            </select>
                            <span className="text-white/30 text-xs ml-auto">{pagination.total} total</span>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="border-b border-white/10">
                                    <tr className="text-white/40 text-left">
                                        <th className="px-5 py-3">Name</th>
                                        <th className="px-5 py-3 hidden md:table-cell">Phone</th>
                                        <th className="px-5 py-3">Panel</th>
                                        <th className="px-5 py-3 hidden md:table-cell">Registered</th>
                                        <th className="px-5 py-3 hidden md:table-cell">Last Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {respondents.map(r => (
                                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="px-5 py-3 text-white">{r.full_name}</td>
                                            <td className="px-5 py-3 text-white/40 hidden md:table-cell">{r.phone_normalized}</td>
                                            <td className="px-5 py-3 text-white/60 capitalize">{r.current_phase.replace('phase_', 'Panel ').replace('closing', 'Closing')}</td>
                                            <td className="px-5 py-3 text-white/40 hidden md:table-cell">
                                                {new Date(r.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-3 text-white/40 hidden md:table-cell">
                                                {r.last_seen_at ? new Date(r.last_seen_at).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {respondents.length === 0 && (
                                        <tr><td colSpan={5} className="px-5 py-8 text-center text-white/30">No results.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.total_pages > 1 && (
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                    disabled={pagination.page === 1}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60
                    disabled:opacity-30 hover:bg-white/10 transition-all"
                                >← Prev</button>
                                <span className="text-white/30 text-sm">Page {pagination.page} / {pagination.total_pages}</span>
                                <button
                                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                    disabled={pagination.page === pagination.total_pages}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60
                    disabled:opacity-30 hover:bg-white/10 transition-all"
                                >Next →</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── QUESTIONS ────────────────────────────────── */}
                {activeTab === 'questions' && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-3 items-center mb-6">
                            <select
                                value={phaseFilter || 'panel_1'}
                                onChange={e => setPhaseFilter(e.target.value)}
                                className="bg-slate-800 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            >
                                {PHASES.map(p => <option key={p} value={p}>{p.replace('panel_', 'Panel ').replace('closing', 'Closing')}</option>)}
                            </select>

                            <select
                                value={affiliationFilter}
                                onChange={e => setAffiliationFilter(e.target.value)}
                                className="bg-slate-800 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            >
                                <option value="">All Affiliations</option>
                                <option value="Academia">Academia</option>
                                <option value="Industry">Industry</option>
                                <option value="Government">Government</option>
                            </select>

                            <select
                                value={countryFilter}
                                onChange={e => setCountryFilter(e.target.value)}
                                className="bg-slate-800 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            >
                                <option value="">All Countries</option>
                                <option value="Indonesia">Indonesia</option>
                                <option value="UK">UK</option>
                                <option value="Both">Both</option>
                            </select>
                        </div>

                        {qLoading && <div className="text-white/40 text-sm">Loading questions...</div>}

                        {!qLoading && questionsData && (
                            <div className="space-y-8">
                                {/* Option Counts Rendering */}
                                {questionsData.option_counts.length > 0 && (
                                    <div className="space-y-6">
                                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2">Multiple Choice & Selection</h3>
                                        <div className="grid grid-cols-1 gap-6">
                                            {Array.from(new Set(questionsData.option_counts.map(q => q.question_code))).map(code => {
                                                const opts = questionsData.option_counts.filter(q => q.question_code === code);
                                                const prompt = opts[0]?.prompt;
                                                const chartHeight = Math.max(300, opts.length * 60);

                                                return (
                                                    <div key={code} className="bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden group">
                                                        {/* Animated Background Effects */}
                                                        <div className="grid-pattern opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                                                        <div className="particles-container opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
                                                            <div className="particle-orb bg-blue-500/10 w-32 h-32 top-0 left-0" style={{ animation: 'float 10s ease-in-out infinite' }}></div>
                                                            <div className="particle-orb bg-purple-500/10 w-40 h-40 bottom-0 right-0" style={{ animation: 'float-reverse 12s ease-in-out infinite' }}></div>
                                                        </div>

                                                        <div className="relative z-10 flex justify-between items-start mb-4 gap-4">
                                                            <h4 className="font-medium text-white/80 text-sm">{prompt}</h4>
                                                            <button
                                                                onClick={() => setFullScreenChart(`q_${code}`)}
                                                                className="text-white/40 hover:text-white p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                                                                title="View Full Screen"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                                            <BarChart data={opts} layout="vertical" margin={{ left: 0, right: 30 }}>
                                                                <defs>
                                                                    <linearGradient id="colorGlow" x1="0" y1="0" x2="1" y2="0">
                                                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                                                        <stop offset="100%" stopColor="#d946ef" stopOpacity={1} />
                                                                    </linearGradient>
                                                                    <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                                                                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#d946ef" floodOpacity="0.4" />
                                                                    </filter>
                                                                </defs>
                                                                <XAxis type="number" stroke="#ffffff33" tick={{ fill: '#ffffff66', fontSize: 11 }} />
                                                                <YAxis dataKey="opt_value" type="category" width={250} tick={{ fill: '#ffffff80', fontSize: 11 }} />
                                                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #ffffff20', borderRadius: 8 }} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} itemStyle={{ color: '#ffffff' }} />
                                                                <Bar
                                                                    dataKey="selection_count"
                                                                    fill="url(#colorGlow)"
                                                                    radius={[0, 6, 6, 0]}
                                                                    label={{ position: 'right', fill: '#ffffff90', fontSize: 12, fontWeight: 'bold' }}
                                                                    shape={(props: any) => {
                                                                        const { x, y, width, height } = props;
                                                                        return <rect x={x} y={y + 4} width={width} height={Math.max(4, height - 8)} fill="url(#colorGlow)" rx={6} ry={6} filter="url(#glowEffect)" />;
                                                                    }}
                                                                />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Likert Rendering */}
                                {questionsData.likert_summary.length > 0 && (
                                    <div className="space-y-6">
                                        <h3 className="font-semibold text-lg border-b border-white/10 pb-2">Likert Scales (1-7)</h3>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {questionsData.likert_summary.map(l => (
                                                <div key={l.question_code} className="bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden group">
                                                    {/* Animated Background Effects */}
                                                    <div className="grid-pattern opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                                                    <div className="particles-container opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
                                                        <div className="particle-orb bg-indigo-500/10 w-24 h-24 -top-4 -left-4" style={{ animation: 'float 8s ease-in-out infinite' }}></div>
                                                        <div className="particle-orb bg-pink-500/10 w-24 h-24 -bottom-4 -right-4" style={{ animation: 'float-reverse 9s ease-in-out infinite' }}></div>
                                                    </div>

                                                    <div className="relative z-10">
                                                        <h4 className="font-medium text-white/80 mb-3 text-sm line-clamp-3" title={l.prompt}>{l.prompt}</h4>
                                                        <div className="flex items-end gap-3 mb-2">
                                                            <span className="text-3xl font-bold text-blue-400">{l.avg_score.toFixed(1)}</span>
                                                            <span className="text-white/40 text-sm pb-1">Average</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-white/30 border-t border-white/10 pt-2">
                                                            <span>Min: {l.min_score}</span>
                                                            <span>Max: {l.max_score}</span>
                                                            <span>{l.response_count} responses</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {questionsData.option_counts.length === 0 && questionsData.likert_summary.length === 0 && (
                                    <div className="text-white/40 text-sm">No responses yet for this phase.</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── EXPORTS & IMPORTS ────────────────────────── */}
                {activeTab === 'exports' && (
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
                        <div className="space-y-4">
                            <h2 className="font-semibold text-lg">Export Data</h2>
                            {[
                                { label: 'Respondents (CSV)', href: '/api/admin/export?type=respondents&format=csv' },
                                { label: 'Respondents (XLSX)', href: '/api/admin/export?type=respondents&format=xlsx' },
                                { label: 'All Responses (CSV)', href: '/api/admin/export?type=responses&format=csv' },
                                { label: 'All Responses (XLSX)', href: '/api/admin/export?type=responses&format=xlsx' },
                            ].map(({ label, href }) => (
                                <a
                                    key={href}
                                    href={href}
                                    download
                                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl
                      px-5 py-4 text-white hover:bg-white/10 hover:border-blue-400/30 transition-all"
                                >
                                    <span className="text-sm">{label}</span>
                                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </a>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <h2 className="font-semibold text-lg">Import Data</h2>
                            <form onSubmit={handleImport} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">Import Type</label>
                                    <select
                                        value={importType}
                                        onChange={e => setImportType(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-shadow"
                                    >
                                        <option value="respondents">1. Respondents Profile</option>
                                        <option value="responses">2. Survey Responses</option>
                                    </select>
                                </div>
                                <div className="border border-white/10 rounded-xl p-4 bg-black/20">
                                    <label className="block text-white/60 text-sm mb-3">Upload File</label>
                                    <input
                                        id="importFileInput"
                                        type="file"
                                        accept=".csv, .xlsx, .xls"
                                        onChange={e => setImportFile(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30 file:transition-colors cursor-pointer"
                                    />
                                    <p className="text-[11px] text-white/40 mt-3">Upload a CSV or XLSX file matching the exact format from the Export Data tool.</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!importFile || isImporting}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 disabled:text-white/30 text-white rounded-xl text-sm font-semibold transition-colors flex justify-center items-center gap-2"
                                >
                                    {isImporting ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                            </svg>
                                            Importing...
                                        </>
                                    ) : 'Start Import'}
                                </button>
                                {importMessage && (
                                    <div className={`p-3 rounded-xl text-sm border ${importMessage.startsWith('Error') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                                        {importMessage}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Full Screen Chart Modal */}
            {fullScreenChart && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-sm">
                    <div className="w-full h-full max-w-7xl bg-slate-800 border border-white/10 rounded-2xl flex flex-col shadow-2xl relative overflow-hidden">
                        {fullScreenChart === 'pie' && overview && overview.collaboration_intent.length > 0 && (
                            <>
                                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-800/50">
                                    <h3 className="text-xl font-bold text-white pr-8">Collaboration Intent</h3>
                                    <button onClick={() => setFullScreenChart(null)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors absolute top-4 right-4">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="flex-1 p-6 flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                                        <PieChart>
                                            <Pie data={overview.collaboration_intent} dataKey="respondent_count" nameKey="intent" cx="50%" cy="50%" outerRadius={250} label={({ name, value }) => `${name} (${value})`} labelLine={true}>
                                                {overview.collaboration_intent.map((_entry, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: '16px' }} itemStyle={{ color: '#ffffff' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        )}
                        {fullScreenChart === 'funnel' && (
                            <>
                                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-800/50">
                                    <h3 className="text-xl font-bold text-white pr-8">Response Funnel</h3>
                                    <button onClick={() => setFullScreenChart(null)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors absolute top-4 right-4">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="flex-1 p-6">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                                        <BarChart data={funnel} layout="vertical" margin={{ left: 20, right: 60, top: 20, bottom: 20 }}>
                                            <XAxis type="number" stroke="#ffffff33" tick={{ fill: '#ffffff66', fontSize: 16 }} />
                                            <YAxis dataKey="label" type="category" width={220} tick={{ fill: '#ffffff80', fontSize: 16 }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: '16px' }} itemStyle={{ color: '#ffffff' }} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} label={{ position: 'right', fill: '#ffffff90', fontSize: 16, fontWeight: 'bold' }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        )}
                        {fullScreenChart.startsWith('q_') && questionsData && (() => {
                            const code = fullScreenChart.replace('q_', '');
                            const opts = questionsData.option_counts.filter(q => q.question_code === code);
                            if (!opts.length) return null;
                            const prompt = opts[0]?.prompt;
                            const chartHeight = Math.max(500, opts.length * 80);
                            return (
                                <>
                                    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-800/50 shrink-0">
                                        <h3 className="text-xl font-bold text-white pr-8 leading-tight">{prompt}</h3>
                                        <button onClick={() => setFullScreenChart(null)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors absolute top-4 right-4 focus:outline-none">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    <div className="flex-1 p-6 overflow-y-auto w-full">
                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                            <BarChart data={opts} layout="vertical" margin={{ left: 20, right: 60, top: 20, bottom: 20 }}>
                                                <defs>
                                                    <linearGradient id="colorGlowModal" x1="0" y1="0" x2="1" y2="0">
                                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                                        <stop offset="100%" stopColor="#d946ef" stopOpacity={1} />
                                                    </linearGradient>
                                                    <filter id="glowEffectModal" x="-20%" y="-20%" width="140%" height="140%">
                                                        <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#d946ef" floodOpacity="0.6" />
                                                    </filter>
                                                </defs>
                                                <XAxis type="number" stroke="#ffffff33" tick={{ fill: '#ffffff66', fontSize: 14 }} />
                                                <YAxis dataKey="opt_value" type="category" width={350} tick={{ fill: '#ffffff80', fontSize: 14 }} />
                                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: '14px' }} itemStyle={{ color: '#ffffff' }} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                                                <Bar
                                                    dataKey="selection_count"
                                                    fill="url(#colorGlowModal)"
                                                    radius={[0, 8, 8, 0]}
                                                    label={{ position: 'right', fill: '#ffffff90', fontSize: 16, fontWeight: 'bold' }}
                                                    shape={(props: any) => {
                                                        const { x, y, width, height } = props;
                                                        return <rect x={x} y={y + 6} width={width} height={Math.max(6, height - 12)} fill="url(#colorGlowModal)" rx={8} ry={8} filter="url(#glowEffectModal)" />;
                                                    }}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Clear Data Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4 text-red-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h2 className="text-lg font-bold">Clear All Data</h2>
                        </div>
                        <p className="text-white/70 text-sm mb-4">
                            You are about to permanently delete all respondent profiles, progress, and survey answers. <strong>This action cannot be undone.</strong>
                        </p>
                        <p className="text-white/70 text-sm mb-2">
                            Please type <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-white font-bold select-all">saya setuju</span> to confirm.
                        </p>
                        <input
                            type="text"
                            value={clearInput}
                            onChange={(e) => setClearInput(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 mb-6"
                            placeholder="saya setuju"
                            autoComplete="off"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowClearModal(false);
                                    setClearInput('');
                                }}
                                className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
                                disabled={isClearing}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearData}
                                disabled={clearInput !== 'saya setuju' || isClearing}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/30 disabled:text-white/30 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {isClearing ? 'Deleting...' : 'Wipe Database'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
