import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const reportId = request.nextUrl.searchParams.get("id") || "";
  if (!reportId) {
    return NextResponse.json({ access: false, free: true }, { status: 400 });
  }

  return NextResponse.json({
    access: true,
    free: true,
    paymentRequired: false,
    reason: "free_mode",
  });
}
