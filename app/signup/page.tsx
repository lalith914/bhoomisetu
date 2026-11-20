
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const sb = getSupabase();

    if (!sb) {
      setError(
        "Supabase is not configured. Check your environment variables."
      );
      return;
    }

    setBusy(true);

    try {
      const { data, error: signupError } = await sb.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/choose-role`,
        },
      });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      if (data.session) {
        router.replace("/choose-role");
        router.refresh();
        return;
      }

      setMessage(
        "Account created. Please check your email and confirm your account before signing in."
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create your account. Please try again."
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

        <Link href="/" className="signin-back">
          ← BACK TO EARTH
        </Link>
      </header>

      <section className="signin-content">
        <div className="signin-kicker">
          BHOOMISETU / CREATE ACCESS
        </div>

        <h1>
          Create your
          <br />
          <i>access.</i>
        </h1>

        <p className="signin-intro">
          Create a BhoomiSetu account to access the land intelligence
          platform.
        </p>

        <form className="signin-form" onSubmit={submit}>
          <label>
            <span>FULL NAME</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </label>

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
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label>
            <span>CONFIRM PASSWORD</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
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

          {message && (
            <div className="signin-success" role="status">
              {message}
            </div>
          )}

          <button type="submit" disabled={busy}>
            {busy
              ? "CREATING ACCOUNT..."
              : "CREATE BHOOMISETU ACCESS ↗"}
          </button>
        </form>

        <div className="signin-footer">
          <span>Already have an account?</span>
          <Link href="/signin">SIGN IN →</Link>
        </div>
      </section>

      <div className="signin-status">
        <span>SECURE CONNECTION</span>
        <span>WGS 84 / INDIA</span>
      </div>
    </main>
  );
}
