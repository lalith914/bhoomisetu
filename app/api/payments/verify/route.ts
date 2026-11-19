import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getViewerIdentity } from "@/lib/server-auth";
import { REPORT_ACCESS_COOKIE, signAccessPayload } from "@/lib/report-access";
import { createClient } from "@supabase/supabase-js";

const AMOUNT = 19900;

export async function POST(request: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const accessSecret = process.env.BHOOMISETU_ACCESS_SECRET;

  if (!keyId || !keySecret || !accessSecret) {
    return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
  }

  const viewer = await getViewerIdentity();
  if (viewer.isOwner) return NextResponse.json({ access: true, free: true });

  let body: {
    reportId?: string;
    email?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });
  }

  const reportId = String(body.reportId || "").trim();
  const orderId = String(body.razorpay_order_id || "").trim();
  const paymentId = String(body.razorpay_payment_id || "").trim();
  const signature = String(body.razorpay_signature || "").trim();
  const email = String(body.email || viewer.email || "").trim().toLowerCase();

  if (!reportId || !orderId || !paymentId || !signature || !email) {
    return NextResponse.json({ error: "Incomplete payment response." }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  const order = await orderResponse.json().catch(() => null);
  if (!orderResponse.ok || order?.amount !== AMOUNT) {
    return NextResponse.json({ error: "The payment order could not be verified." }, { status: 400 });
  }

  if (order?.notes?.report_id !== reportId || String(order?.notes?.customer_email || "").toLowerCase() !== email) {
    return NextResponse.json({ error: "Payment does not match this report." }, { status: 400 });
  }

  const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  const payment = await paymentResponse.json().catch(() => null);
  if (!paymentResponse.ok || payment?.order_id !== orderId || payment?.amount !== AMOUNT || payment?.status !== "captured") {
    return NextResponse.json({ error: "Payment is not captured yet. Enable Razorpay automatic capture and try again." }, { status: 400 });
  }

  const payload = Buffer.from(
    JSON.stringify({
      reportId,
      email,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
    })
  ).toString("base64url");

  const token = `${payload}.${signAccessPayload(payload)}`;

  // Durable audit record when the server-only Supabase secret is configured.
  // The cookie remains the immediate access grant for the current browser.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (supabaseUrl && supabaseSecret) {
    try {
      const admin = createClient(supabaseUrl, supabaseSecret, { auth: { persistSession: false, autoRefreshToken: false } });
      await admin.from("report_payments").upsert({
        report_id: reportId,
        email,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        amount: AMOUNT,
        currency: "INR",
        status: "captured",
      }, { onConflict: "razorpay_payment_id" });
    } catch (error) {
      console.warn("BhoomiSetu payment audit write failed:", error);
    }
  }

  const response = NextResponse.json({ access: true });
  response.cookies.set(REPORT_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
