"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccessBlockedPage() {
  const [loading, setLoading] = useState(false);
  async function signOut() {
    setLoading(true);
    await createClient().auth.signOut();
    window.location.assign("/login");
  }
  return <main className="login-page"><section className="login-card"><p className="eyebrow">ACCESS PAUSED</p><h1>Ustaz access is currently blocked</h1><p>The Exam Admin has temporarily blocked Ustaz sign-in while examination results are being managed.</p><button type="button" onClick={() => void signOut()} disabled={loading}>{loading ? "Signing out..." : "Sign out"}</button></section></main>;
}
