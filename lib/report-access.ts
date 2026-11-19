import crypto from "node:crypto";

export const REPORT_ACCESS_COOKIE = "bs_report_access";

export function signAccessPayload(payload: string) {
  const secret = process.env.BHOOMISETU_ACCESS_SECRET;
  if (!secret) throw new Error("BHOOMISETU_ACCESS_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyAccessToken(token: string | undefined, reportId: string, email: string | null) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = signAccessPayload(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.reportId === reportId && parsed.exp > Date.now() && (!parsed.email || !email || parsed.email === email);
  } catch {
    return false;
  }
}
