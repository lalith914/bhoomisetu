import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getViewerIdentity } from "@/lib/server-auth";

const AMOUNT = 19900;

export async function POST(request: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 503 }
    );
  }

  const viewer = await getViewerIdentity();
  if (viewer.isOwner) {
    return NextResponse.json({ free: true });
  }

  let body: { reportId?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reportId = String(body.reportId || "").trim();
  const email = String(body.email || viewer.email || "").trim().toLowerCase();

  if (!reportId || !email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid report ID and email are required." }, { status: 400 });
  }

  const receipt = `bs_${crypto.randomBytes(8).toString("hex")}`;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: AMOUNT,
      currency: "INR",
      receipt,
      notes: {
        report_id: reportId,
        customer_email: email,
        product: "BhoomiSetu Full Land Intelligence Report",
      },
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error?.description || "Unable to create Razorpay order." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    orderId: data.id,
    amount: data.amount,
    currency: data.currency,
    keyId,
    email,
  });
}
