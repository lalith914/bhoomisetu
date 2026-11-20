
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const reportId = String(body?.reportId || "").trim();
  const question = String(body?.question || "").trim();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!reportId) {
    return NextResponse.json(
      { error: "Report ID is required." },
      { status: 400 }
    );
  }

  if (!question) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const prompt = `
You are BhoomiSetu's land intelligence assistant.

Answer using only the supplied parcel analysis.

Rules:
- Never invent soil, water, ownership or agricultural facts.
- Clearly state when field verification is required.
- Keep answers concise and useful.
- Do not make legal ownership or title claims.
- Explain technical terms simply.

USER QUESTION:
${question}

PARCEL ANALYSIS:
${JSON.stringify(body?.analysis || {})}
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: prompt,
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
            "Gemini Interactions API request failed.",
        },
        { status: 502 }
      );
    }

    const answer = (data?.steps || [])
      .filter((step: any) => step.type === "model_output")
      .flatMap((step: any) => step.content || [])
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text || "")
      .join("\n")
      .trim();

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
