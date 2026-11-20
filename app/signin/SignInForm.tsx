
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") || "");
  const [busy, setBusy] = useState(false);

  const confirmed = params.get("confirmed") === "1";
  const passwordReset = params.get("password_reset") === "1";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const sb = getSupabase();

    if (!sb) {
      setError("Supabase is not configured. Check your environment variables.");
      setBusy(false);
      return;
    }

    try {
      const { error: signInError } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }

      const { data: verified, error: userError } = await sb.auth.getUser();

      if (userError || !verified.user) {
        const { data: refreshed, error: refreshError } =
          await sb.auth.refreshSession();

        if (refreshError || !refreshed.session?.user) {
          setError(
            "Login succeeded, but your session could not be restored. Please try again."
          );
          setBusy(false);
          return;
        }
      }

      const next = params.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/choose-role";

      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
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

        <Link href="/" className="signin-back">
          ← BACK TO EARTH
        </Link>
      </header>

      <section className="signin-content">
        <div className="signin-kicker">BHOOMISETU / SECURE ACCESS</div>

        <h1>
          Enter the
          <br />
          <i>platform.</i>
        </h1>

        <p className="signin-intro">
          Sign in to explore land intelligence, manage properties and make
          informed decisions.
        </p>

        <form className="signin-form" onSubmit={handleSubmit}>
          <label>
            <span>EMAIL ADDRESS</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>PASSWORD</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="forgot-password-row">
            <Link href="/forgot-password">FORGOT PASSWORD?</Link>
          </div>

          {passwordReset && (
            <div className="signin-success" role="status">
              Your password has been updated. Sign in using your new password.
            </div>
          )}

          {confirmed && (
            <div className="signin-success" role="status">
              Your email has been confirmed. You can now sign in.
            </div>
          )}

          {error && (
            <div className="signin-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy}>
            {busy ? "AUTHENTICATING..." : "ENTER BHOOMISETU ↗"}
          </button>
        </form>

        <div className="signin-footer">
          <span>New to BhoomiSetu?</span>
          <Link href="/signup">CREATE ACCESS →</Link>
        </div>
      </section>

      <div className="signin-status">
        <span>SECURE CONNECTION</span>
        <span>WGS 84 / INDIA</span>
      </div>
    </main>
  );
}
