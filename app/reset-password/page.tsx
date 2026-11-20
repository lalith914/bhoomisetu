
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      const sb = getSupabase();

      if (!sb) {
        if (active) {
          setError("Supabase is not configured. Please contact support.");
          setChecking(false);
        }
        return;
      }

      try {
        const { data, error: sessionError } = await sb.auth.getUser();

        if (!active) return;

        if (sessionError || !data.user) {
          setValidSession(false);
          setError(
            "This reset link is invalid or has expired. Request a new password-reset email."
          );
        } else {
          setValidSession(true);
        }
      } catch {
        if (active) {
          setError(
            "Unable to verify this reset link. Please request a new one."
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    checkRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    const sb = getSupabase();

    if (!sb) {
      setError("Supabase is not configured.");
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await sb.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await sb.auth.signOut();

      router.replace("/signin?password_reset=1");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your password. Request a new reset link."
      );
    } finally {
      setSaving(false);
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
        <div className="signin-kicker">BHOOMISETU / NEW CREDENTIALS</div>

        <h1>
          Choose a new
          <br />
          <i>password.</i>
        </h1>

        <p className="signin-intro">
          Set a new password for your BhoomiSetu account. Use at least
          8 characters.
        </p>

        {checking ? (
          <p className="signin-intro">Verifying your secure reset link...</p>
        ) : !validSession ? (
          <>
            {error && (
              <div className="signin-error" role="alert">
                {error}
              </div>
            )}

            <div className="signin-footer">
              <span>Need another reset link?</span>
              <Link href="/forgot-password">TRY AGAIN →</Link>
            </div>
          </>
        ) : (
          <form className="signin-form" onSubmit={handleSubmit}>
            <label>
              <span>NEW PASSWORD</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <label>
              <span>CONFIRM NEW PASSWORD</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter the password again"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            {error && (
              <div className="signin-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" disabled={saving}>
              {saving ? "UPDATING PASSWORD..." : "UPDATE PASSWORD ↗"}
            </button>
          </form>
        )}
      </section>

      <div className="signin-status">
        <span>SECURE CONNECTION</span>
        <span>PASSWORD RECOVERY</span>
      </div>
    </main>
  );
}
