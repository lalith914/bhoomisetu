import { NextRequest, NextResponse } from "next/server";
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const reportId = String(body?.reportId || "").trim();
  if (!reportId) {
    return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  const question = String(body?.question || "").trim();
  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const model = process.env.OPENAI_MODEL || "gpt-5";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{
        role: "user",
        content: [{
          type: "input_text",
          text: `You are BhoomiSetu's land intelligence assistant. Answer the user's question using only the supplied parcel analysis. Never invent soil, water, ownership, title, legal or agronomic facts. State when field verification is required. Keep the answer concise and decision-oriented.\n\nQUESTION: ${question}\n\nPARCEL ANALYSIS: ${JSON.stringify(body?.analysis || {})}`,
        }],
      }],
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || "AI request failed." }, { status: 502 });
  return NextResponse.json({ answer: data?.output_text || "The AI provider returned no answer." });
}
