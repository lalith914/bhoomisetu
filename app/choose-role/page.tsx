"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function ChooseRolePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const sb = getSupabase();
    if (!sb) { router.replace("/signin"); return; }
    const verify = async () => {
      try {
        const { data } = await sb.auth.getUser();
        if (!active) return;
        if (data.user) { setChecking(false); return; }
        const { data: refreshed } = await sb.auth.refreshSession();
        if (!active) return;
        if (refreshed.session?.user) setChecking(false);
        else router.replace("/signin?next=%2Fchoose-role");
      } catch { if (active) router.replace("/signin?next=%2Fchoose-role"); }
    };
    void verify();
    return () => { active = false; };
  }, [router]);

  if (checking) return <main className="role-page"><div className="role-content"><div className="role-kicker">BHOOMISETU / ACCESS</div><h1>Checking your<br/><i>access.</i></h1></div></main>;

  return (
    <main className="role-page">
      <div className="role-grid" />
      <header className="role-header"><Link href="/" className="role-brand">BHOOMI<span>SETU</span></Link><span className="role-status">PLATFORM ACCESS / 01</span></header>
      <section className="role-content">
        <div className="role-kicker">BHOOMISETU / ACCESS</div>
        <h1>What are you<br/>here to <i>do?</i></h1>
        <p className="role-intro">Choose your role to enter the BhoomiSetu land intelligence platform.</p>
        <div className="role-cards">
          <Link href="/buyer" className="role-card"><span className="role-number">01</span><div><small>FOR LAND SEEKERS</small><h2>BUYER</h2><p>Discover land, explore parcels, understand terrain and make informed decisions.</p></div><strong>↗</strong></Link>
          <Link href="/owner" className="role-card"><span className="role-number">02</span><div><small>FOR LAND OWNERS</small><h2>OWNER</h2><p>Register your land, manage properties, submit documents and connect with buyers.</p></div><strong>↗</strong></Link>
        </div>
        <div className="role-footer"><span>Account active.</span><Link href="/account">GO TO ACCOUNT →</Link></div>
      </section>
    </main>
  );
}
