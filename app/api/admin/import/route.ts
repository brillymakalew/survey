import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string;

        if (!file || !type) {
            return NextResponse.json({ success: false, error: 'Missing file or type' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let data: Record<string, string>[] = [];

        // Parse file based on extension
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const wb = XLSX.read(buffer, { type: 'buffer' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            data = XLSX.utils.sheet_to_json(ws);
        } else if (fileName.endsWith('.csv')) {
            const csvText = buffer.toString('utf-8');
            const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            if (result.errors.length > 0) {
                return NextResponse.json({ success: false, error: 'Failed to parse CSV' });
            }
            data = result.data as Record<string, string>[];
        } else {
            return NextResponse.json({ success: false, error: 'Unsupported file type. Please upload a .csv or .xlsx file.' }, { status: 400 });
        }

        if (data.length === 0) {
            return NextResponse.json({ success: false, error: 'Uploaded file is empty.' }, { status: 400 });
        }

        const supabase = createServerClient();

        if (type === 'respondents') {
            // Upsert respondents
            // Required columns: full_name, phone_normalized, current_phase, status
            const toUpsert = data.map(row => {
                if (!row.phone_normalized) return null;
                return {
                    id: row.id || undefined, // use id if present, otherwise let db generate
                    full_name: row.full_name || 'Unknown',
                    phone_raw: row.phone_normalized, // We insert phone_raw as the same normalized if it's imported
                    phone_normalized: row.phone_normalized,
                    current_phase: row.current_phase || 'panel_1',
                    status: row.status || 'active',
                };
            }).filter(Boolean);

            if (toUpsert.length === 0) return NextResponse.json({ success: false, error: 'No valid respondents to insert. Make sure phone_normalized column exists.' });

            const { error } = await supabase.from('respondents').upsert(toUpsert, { onConflict: 'phone_normalized' });
            if (error) {
                console.error('Import Respondents Error:', error);
                return NextResponse.json({ success: false, error: error.message });
            }
            return NextResponse.json({ success: true, count: toUpsert.length, message: `Successfully imported ${toUpsert.length} respondents.` });

        } else if (type === 'responses') {
            // Required exported columns: phone_normalized, question_code, phase_code, answer, answer_text

            // 1. Get all respondents to map phone_normalized -> respondent_id
            const { data: respondents, error: respErr } = await supabase.from('respondents').select('id, phone_normalized');
            if (respErr) return NextResponse.json({ success: false, error: respErr.message });
            const respMap = new Map((respondents || []).map(r => [r.phone_normalized, r.id]));

            // 2. Get all questions to map question_code -> question_id + phase_id
            const { data: questions, error: qErr } = await supabase.from('survey_questions').select('id, question_code, phase_id');
            if (qErr) return NextResponse.json({ success: false, error: qErr.message });
            const qMap = new Map((questions || []).map(q => [q.question_code, { qid: q.id, pid: q.phase_id }]));

            // 3. We also need session IDs, one active session per respondent.
            const { data: sessions, error: sessErr } = await supabase.from('response_sessions').select('id, respondent_id');
            if (sessErr) return NextResponse.json({ success: false, error: sessErr.message });
            const sessMap = new Map((sessions || []).map(s => [s.respondent_id, s.id]));

            let sessionInserts = [];
            const processedRows = [];
            const missingDataRows = [];
            const progressMap = new Map<string, any>();

            for (const row of data) {
                const phone = row.phone_normalized;
                const qCode = row.question_code;
                const answerStr = row.answer;

                if (!phone || !qCode || !answerStr) {
                    missingDataRows.push(row);
                    continue;
                }

                const respondentId = respMap.get(phone);
                const qInfo = qMap.get(qCode);

                if (!respondentId || !qInfo) {
                    continue; // Skip if respondent doesn't exist or question code is invalid
                }

                let sessionId = sessMap.get(respondentId);
                if (!sessionId) {
                    // We need to create a session if one doesn't exist
                    sessionInserts.push({ respondent_id: respondentId, status: 'active' });
                }

                let answerJson = {};
                try {
                    answerJson = JSON.parse(answerStr);
                } catch {
                    answerJson = answerStr; // fallback if it's not valid json
                }

                processedRows.push({
                    respondent_id: respondentId,
                    question_id: qInfo.qid,
                    phase_id: qInfo.pid,
                    answer_value_json: answerJson,
                    answer_text: row.answer_text || null,
                    is_finalized: String(row.is_finalized) === 'true',
                    answered_at: row.answered_at ? new Date(row.answered_at).toISOString() : new Date().toISOString()
                });

                // Track progress
                const pKey = `${respondentId}_${qInfo.pid}`;
                if (!progressMap.has(pKey)) {
                    progressMap.set(pKey, {
                        respondent_id: respondentId,
                        phase_id: qInfo.pid,
                        status: 'completed', // Assume completed since they have responses exported
                        completion_percent: 100,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            // Create missing sessions
            if (sessionInserts.length > 0) {
                const uniqueSessionsMap = new Map();
                for (const s of sessionInserts) uniqueSessionsMap.set(s.respondent_id, s);
                const uniqueSessionInserts = Array.from(uniqueSessionsMap.values());

                const { data: newSessions, error: newSessErr } = await supabase.from('response_sessions').insert(uniqueSessionInserts).select('id, respondent_id');
                if (newSessErr) return NextResponse.json({ success: false, error: newSessErr.message });

                // update sessMap
                newSessions?.forEach(ns => sessMap.set(ns.respondent_id, ns.id));
            }

            // Upsert phase progress
            const progressList = Array.from(progressMap.values());
            if (progressList.length > 0) {
                const chunkSize = 1000;
                for (let i = 0; i < progressList.length; i += chunkSize) {
                    const chunk = progressList.slice(i, i + chunkSize);
                    await supabase.from('phase_progress').upsert(chunk, { onConflict: 'respondent_id,phase_id' });
                }
            }

            // Add session_id to processed rows and upsert
            const toUpsert = processedRows.map(r => ({
                ...r,
                session_id: sessMap.get(r.respondent_id)
            })).filter(r => r.session_id); // ensure session_id is there

            if (toUpsert.length === 0) return NextResponse.json({ success: false, error: 'No valid responses to insert.' });

            // survey_responses has a unique constraint on (respondent_id, question_id). Upsert using that.
            const chunkSize = 1000;
            let successCount = 0;
            for (let i = 0; i < toUpsert.length; i += chunkSize) {
                const chunk = toUpsert.slice(i, i + chunkSize);
                const { error: upsertErr } = await supabase.from('survey_responses')
                    .upsert(chunk, { onConflict: 'respondent_id,question_id' });

                if (upsertErr) {
                    console.error('Import Responses Error:', upsertErr);
                    return NextResponse.json({ success: false, error: upsertErr.message });
                }
                successCount += chunk.length;
            }

            return NextResponse.json({ success: true, count: successCount, message: `Successfully imported ${successCount} responses.` });

        } else {
            return NextResponse.json({ success: false, error: 'Invalid import type' }, { status: 400 });
        }

    } catch (err) {
        console.error('[/api/admin/import]', err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
