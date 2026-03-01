import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const adminSession = request.cookies.get('admin_session')?.value;
        if (!adminSession) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServerClient();
        const { data, error } = await supabase
            .from('ai_insights')
            .select('summary_text')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        return NextResponse.json({ success: true, summary: data?.[0]?.summary_text || '' });
    } catch (err) {
        console.error('[/api/admin/dashboard/ai-summary] GET', err);
        return NextResponse.json({ success: false, error: 'Database error fetching summary.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const adminSession = request.cookies.get('admin_session')?.value;
        if (!adminSession) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ success: false, error: 'OpenAI API Key is missing.' }, { status: 500 });
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const supabase = createServerClient();

        // Fetch raw responses for all questions for active respondents
        const { data: rawResponses } = await supabase
            .from('survey_responses')
            .select(`
                respondent_id, answer_value_json,
                survey_questions!inner(question_code, prompt, question_type),
                respondents!inner(status)
            `)
            .neq('respondents.status', 'deleted');

        // Aggregate content data
        const questionsMap: Record<string, {
            prompt: string;
            type: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            responses: any[];
        }> = {};

        for (const r of (rawResponses || [])) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { question_code, prompt, question_type } = r.survey_questions as any;
            let val = r.answer_value_json;
            // Unpack if stored as {"q_code": "val"}
            if (val && typeof val === 'object' && !Array.isArray(val) && val[question_code] !== undefined) {
                val = val[question_code];
            }
            if (val === null || val === undefined || val === '') continue;

            if (!questionsMap[question_code]) {
                questionsMap[question_code] = { prompt, type: question_type, responses: [] };
            }
            questionsMap[question_code].responses.push(val);
        }

        // Process maps into a condensed format for the AI
        const aiData = Object.entries(questionsMap).map(([, q]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let summary: any;
            if (q.type === 'single_choice' || q.type === 'multi_select') {
                const counts: Record<string, number> = {};
                q.responses.forEach(val => {
                    const arr = Array.isArray(val) ? val : [val];
                    arr.forEach(v => {
                        const sval = String(v);
                        counts[sval] = (counts[sval] || 0) + 1;
                    });
                });
                summary = counts;
            } else if (q.type === 'likert') {
                const nums = q.responses.map(Number).filter(n => !isNaN(n));
                if (nums.length > 0) {
                    const sum = nums.reduce((a, b) => a + b, 0);
                    summary = {
                        average: Number((sum / nums.length).toFixed(2)),
                        min: Math.min(...nums),
                        max: Math.max(...nums),
                        count: nums.length
                    };
                }
            } else {
                // Qualitative text entries
                // Filter out extremely short/unhelpful answers like "no", "n/a", "-"
                const textAnswers = q.responses.map(String).filter(s => s.trim().length > 3);
                // Limit to 60 qualitative responses per question to avoid blowing up the OpenAI token limit
                summary = textAnswers.slice(0, 60);
            }

            return {
                question: q.prompt,
                type: q.type,
                data: summary
            };
        });

        const promptText = `
You are an expert qualitative and quantitative data analyst.
I have aggregated the actual content and collected answers from a recent survey.

Here is the data, grouped by survey question:
${JSON.stringify(aiData, null, 2)}

Your task is to provide a DEEP, highly detailed analytical summarization of the SURVEY CONTENT. 
Do not talk about form completion rates or drop-offs data. Focus entirely on WHAT the respondents actually said and answered in the questions.

Focus on:
1. Deeply analyzing the textual and categorical responses to pull out key themes, recurring sentiments, and significant insights.
2. Identifying actionable patterns and what these answers mean for the organization.
3. Suggesting concrete follow-up actions that can be done collaboratively by all participants and other stakeholders based strictly on these findings.

Output the summary in clean Markdown format with professional headers, bullet points, and bold text for emphasis.
`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an expert data analyst that provides deep, actionable content summaries.' },
                { role: 'user', content: promptText }
            ],
            max_tokens: 1500,
            temperature: 0.7,
        });

        const summary = response.choices[0]?.message?.content || 'No summary generated.';

        // Save to DB
        await supabase.from('ai_insights').insert({ summary_text: summary });

        return NextResponse.json({ success: true, summary });

    } catch (err) {
        console.error('[/api/admin/dashboard/ai-summary] POST', err);
        return NextResponse.json({ success: false, error: 'Internal server error while generating summary.' }, { status: 500 });
    }
}
