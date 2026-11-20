
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const reportId = String(body?.reportId || "").trim();

  if (!reportId) {
    return NextResponse.json(
      { error: "Report ID is required." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const question = String(body?.question || "").trim();

  if (!question) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 }
    );
  }

  const model =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt = `
You are BhoomiSetu's land intelligence assistant.

Answer the user's question using only the supplied parcel analysis.

Rules:
- Never invent soil, water, ownership, title or agricultural facts.
- Clearly state when field verification is required.
- Keep answers concise and useful.
- Do not make legal ownership or title claims.
- Explain technical terms in simple language.

USER QUESTION:
${question}

PARCEL ANALYSIS:
${JSON.stringify(body?.analysis || {})}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
          },
        }),
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Gemini AI request failed.",
        },
        { status: 502 }
      );
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("");

    return NextResponse.json({
      answer: answer || "Gemini returned no answer.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to contact Gemini.",
      },
      { status: 502 }
    );
  }
}
