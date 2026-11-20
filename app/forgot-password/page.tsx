
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    const sb = getSupabase();

    if (!sb) {
      setError("Supabase is not configured. Check your environment variables.");
      return;
    }

    setBusy(true);

    try {
      const redirectTo =
        `${window.location.origin}/auth/callback?next=/reset-password`;

      const { error: resetError } =
        await sb.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo,
        });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        "If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the reset email. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin-page">
      <div className="signin-grid" />

      <header className="signin-header">
        <Link href="/" className="signin-brand">
          BHOOMI<span>SETU</span>
        </Link>

        <Link href="/signin" className="signin-back">
          ← BACK TO SIGN IN
        </Link>
      </header>

      <section className="signin-content">
        <div className="signin-kicker">BHOOMISETU / ACCOUNT RECOVERY</div>

        <h1>
          Reset your
          <br />
          <i>password.</i>
        </h1>

        <p className="signin-intro">
          Enter the email address connected to your BhoomiSetu account.
          We will send you a secure password-reset link.
        </p>

        <form className="signin-form" onSubmit={handleSubmit}>
          <label>
            <span>REGISTERED EMAIL ADDRESS</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {error && (
            <div className="signin-error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="signin-success" role="status">
              {message}
            </div>
          )}

          <button type="submit" disabled={busy}>
            {busy ? "SENDING EMAIL..." : "SEND RESET LINK ↗"}
          </button>
        </form>

        <div className="signin-footer">
          <span>Remember your password?</span>
          <Link href="/signin">SIGN IN →</Link>
        </div>
      </section>

      <div className="signin-status">
        <span>SECURE CONNECTION</span>
        <span>ACCOUNT RECOVERY</span>
      </div>
    </main>
  );
}
