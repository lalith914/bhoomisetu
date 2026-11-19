"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function SignInPage() {
 const router=useRouter(); const params=useSearchParams();
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(params.get("error") || ""); const [busy,setBusy]=useState(false); const confirmed=params.get("confirmed") === "1";
 async function handleSubmit(e:FormEvent<HTMLFormElement>){ e.preventDefault(); setError(""); setBusy(true); const sb=getSupabase(); if(!sb){setError("Supabase is not configured. Check your .env.local file.");setBusy(false);return;}
  const {error}=await sb.auth.signInWithPassword({email:email.trim(),password}); if(error){setError(error.message);setBusy(false);return;}
  const { data: verified } = await sb.auth.getUser();
  if (!verified.user) {
    const { data: refreshed } = await sb.auth.refreshSession();
    if (!refreshed.session?.user) { setError("Login succeeded, but the session could not be restored. Check your Supabase Auth URL and cookie configuration."); setBusy(false); return; }
  }
  const next=params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/choose-role";
  router.replace(safeNext); router.refresh();
 }
 return <main className="signin-page"><div className="signin-grid"/><header className="signin-header"><Link href="/" className="signin-brand">BHOOMI<span>SETU</span></Link><Link href="/" className="signin-back">← BACK TO EARTH</Link></header><section className="signin-content"><div className="signin-kicker">BHOOMISETU / SECURE ACCESS</div><h1>Enter the<br/><i>platform.</i></h1><p className="signin-intro">Sign in to explore land intelligence, manage properties and make informed decisions.</p><form className="signin-form" onSubmit={handleSubmit}><label><span>EMAIL ADDRESS</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label><label><span>PASSWORD</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required/></label>{confirmed&&!error&&<div className="signin-error">Account created. If email confirmation is enabled, confirm your email first, then sign in.</div>}{error&&<div className="signin-error">{error}</div>}<button type="submit" disabled={busy}>{busy?"AUTHENTICATING...":"ENTER BHOOMISETU ↗"}</button></form><div className="signin-footer"><span>New to BhoomiSetu?</span><Link href="/signup">CREATE ACCESS →</Link></div></section><div className="signin-status"><span>SECURE CONNECTION</span><span>WGS 84 / INDIA</span></div></main>;
}
