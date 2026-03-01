import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/export?type=respondents|responses&format=csv|xlsx
 * PRD §5.8.4 — Export respondents or raw responses as CSV or XLSX.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'csv';    // csv | xlsx
        const type = searchParams.get('type') || 'respondents'; // respondents | responses

        const supabase = createServerClient();
        let data: Record<string, unknown>[] = [];
        let filename = '';

        if (type === 'respondents') {
            const { data: rows } = await supabase
                .from('respondents')
                .select('id, full_name, phone_normalized, current_phase, status, created_at, last_seen_at')
                .neq('status', 'deleted')
                .order('created_at', { ascending: false });
            data = (rows || []) as Record<string, unknown>[];
            filename = `respondents_${new Date().toISOString().slice(0, 10)}`;

        } else if (type === 'responses') {
            const { data: rows } = await supabase
                .from('survey_responses')
                .select(`
          respondent_id,
          respondents!inner(full_name, phone_normalized, status),
          survey_questions(question_code, prompt, question_type),
          survey_phases(phase_code),
          answer_value_json,
          answer_text,
          is_finalized,
          answered_at
        `)
                .neq('respondents.status', 'deleted')
                .order('answered_at', { ascending: false });

            data = (rows || []).map((r: Record<string, unknown>) => {
                const respondent = r.respondents as Record<string, unknown> | null;
                const question = r.survey_questions as Record<string, unknown> | null;
                const phase = r.survey_phases as Record<string, unknown> | null;
                return {
                    respondent_id: r.respondent_id,
                    full_name: respondent?.full_name,
                    phone_normalized: respondent?.phone_normalized,
                    phase_code: phase?.phase_code,
                    question_code: question?.question_code,
                    question_prompt: question?.prompt,
                    answer: JSON.stringify(r.answer_value_json),
                    answer_text: r.answer_text,
                    is_finalized: r.is_finalized,
                    answered_at: r.answered_at,
                };
            });
            filename = `responses_${new Date().toISOString().slice(0, 10)}`;
        }

        if (format === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
                },
            });
        }

        // CSV
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        const csvRows = [
            headers.join(','),
            ...data.map(row =>
                headers.map(h => {
                    const val = String((row)[h] ?? '');
                    return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
                }).join(',')
            ),
        ];
        return new NextResponse(csvRows.join('\n'), {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}.csv"`,
            },
        });
    } catch (err) {
        console.error('[/api/admin/export]', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
